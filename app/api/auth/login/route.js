import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SPREADSHEET_ID = '1ci6vbrkWOHkq2k-HBhFOdOBprusA_hlw09-B1VCeZe4';
const USERS_SPREADSHEET_ID = '1mkzKRLQliz5W3Hi45vPmn3fxf-EMnn4iIUpRkeZ9st8';

function createToken(username, role) {
  const secret = process.env.SESSION_SECRET || 'fallback';
  const payload = Buffer.from(JSON.stringify({
    username,
    role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  })).toString('base64');
  const sig = createHmac('sha256', secret).update(payload).digest('base64');
  return `${payload}.${sig}`;
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    // Check admin credentials (hardcoded, can never be disabled)
    const adminUser = process.env.ADMIN_USERNAME || 'Mouad';
    const adminPass = process.env.ADMIN_PASSWORD || 'CRAdmin@2026!';
    if (username === adminUser && password === adminPass) {
      const token = createToken(username, 'super_admin');
      const res = NextResponse.json({ ok: true, role: 'admin' });
      res.cookies.set('cr_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
      return res;
    }

    // Check users from Google Sheet
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const api = google.sheets({ version: 'v4', auth });

    const res = await api.spreadsheets.values.get({
      spreadsheetId: USERS_SPREADSHEET_ID,
      range: 'Users',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = res.data.values || [];
    // Headers: Username | Password | Active | Role
    const users = rows.slice(1).map(r => ({
      username: String(r[0] || '').trim(),
      password: String(r[1] || '').trim(),
      active:   String(r[2] || '').toLowerCase().trim() === 'yes',
      role:     String(r[3] || 'user').trim(),
    }));

    const user = users.find(u => u.username === username && u.password === password && u.active);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials or account disabled' }, { status: 401 });
    }

    const token = createToken(user.username, user.role);
    const response = NextResponse.json({ ok: true, role: user.role });
    response.cookies.set('cr_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('Login error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
