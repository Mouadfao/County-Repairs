import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SPREADSHEET_ID = '1ci6vbrkWOHkq2k-HBhFOdOBprusA_hlw09-B1VCeZe4';

async function getSheetsApi() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

import { createHmac } from 'crypto';

// Check if caller is admin by verifying the session cookie properly
function isAdmin(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/cr_session=([^;]+)/);
    if (!match) return false;
    const token = match[1];
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return false;
    const secret = process.env.SESSION_SECRET || 'fallback';
    const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64');
    if (expectedSig !== sig) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return false;
    return payload.role === 'admin';
  } catch { return false; }
}

// GET — list all users
export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const api = await getSheetsApi();
    const res = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({ users: [] });

    const users = rows.slice(1).map((r, i) => ({
      row:      i + 2, // 1-indexed, skip header
      username: String(r[0] || '').trim(),
      active:   String(r[2] || '').toLowerCase().trim() === 'yes',
      role:     String(r[3] || 'user').trim(),
    }));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — add new user
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { username, password, role } = await request.json();
    if (!username || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const api = await getSheetsApi();

    // Check user doesn't already exist
    const existing = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A:A',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const names = (existing.data.values || []).map(r => String(r[0] || '').toLowerCase().trim());
    if (names.includes(username.toLowerCase().trim())) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    // Append new row
    await api.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[username.trim(), password, 'yes', role || 'user']],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — toggle active status
export async function PATCH(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { row, active } = await request.json();
    const api = await getSheetsApi();

    await api.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Users!C${row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[active ? 'yes' : 'no']] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove user
export async function DELETE(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { row } = await request.json();
    const api = await getSheetsApi();

    // Get spreadsheet ID for the Users sheet
    const meta = await api.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const usersSheet = meta.data.sheets.find(s => s.properties.title === 'Users');
    if (!usersSheet) return NextResponse.json({ error: 'Users sheet not found' }, { status: 404 });

    await api.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: usersSheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: row - 1,
              endIndex: row,
            },
          },
        }],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
