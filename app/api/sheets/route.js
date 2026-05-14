import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SPREADSHEET_ID = '1ci6vbrkWOHkq2k-HBhFOdOBprusA_hlw09-B1VCeZe4';

// ── status normalizer (case-insensitive) ──────────────────────────────────
const normalizeStatus = raw => {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'paid')          return 'Paid';
  if (s === 'sfdp')          return 'SFDP';
  if (s === 'scheduled')     return 'Scheduled';
  if (s === 'charge back')   return 'Charge Back';
  if (s === 'admin refund')  return 'Admin Refund';
  if (s === 'manual refund') return 'Manual Refund';
  if (s === 'cancelled')     return 'Cancelled';
  if (s === 'payment fail')  return 'Payment Fail';
  return null;
};

// ── normalize name: strip UAG suffix + title-case ─────────────────────────
const normalizeName = raw => {
  return String(raw || '')
    .replace(/\s+UAG\s*$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
};

// ── extract year robustly ─────────────────────────────────────────────────
// Handles: "2026", "2026.0", 2026, 2026.0, formula strings → extracts 4-digit year
const extractYear = v => {
  const s = String(v || '').trim();
  // Try to find a 4-digit year number in the string
  const match = s.match(/(20\d{2})/);
  if (match) return match[1];
  // Try parsing as a float
  const n = parseFloat(s);
  if (!isNaN(n) && n > 2000 && n < 2100) return String(Math.round(n));
  return '';
};

const num = v => { const n = parseFloat(String(v || '').replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
const str = v => String(v || '').trim();
const colMap = headers => { const m = {}; headers.forEach((h, i) => { m[str(h)] = i; }); return m; };
const get = (row, map, name, fallback) => row[map[name] !== undefined ? map[name] : fallback] ?? '';

async function getSheet(api, range) {
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return res.data.values || [];
}

export async function GET() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const api  = google.sheets({ version: 'v4', auth });

    const [dataRows, targetRows] = await Promise.all([
      getSheet(api, 'Data'),
      getSheet(api, 'Target_List'),
    ]);

    const dc = colMap(dataRows[0] || []);

    // ── SALES rows ────────────────────────────────────────────────────────
    const sales = dataRows.slice(1).map(r => {
      const rawStatus = str(get(r, dc, 'Status', 6));
      const status    = normalizeStatus(rawStatus);
      if (!status || status === 'Payment Fail' || status === 'Cancelled') return null;
      const rawAgent = str(get(r, dc, 'Agent', 11));
      if (!rawAgent) return null;

      // Extract year: try Year col first, fall back to parsing the Month col number prefix
      const rawYear = get(r, dc, 'Year', 0);
      const rawMonth = str(get(r, dc, 'Month', 1));
      let year = extractYear(rawYear);
      // If year col gave nothing (formula returned empty), try to get year from date col
      if (!year) {
        const rawDate = str(get(r, dc, 'Date', 2));
        year = extractYear(rawDate);
      }

      return {
        year,
        month:    rawMonth,
        date:     str(get(r, dc, 'Date', 2)),
        crmRef:   str(get(r, dc, 'CRMRef', 3)),
        customer: str(get(r, dc, 'Name of Client', 4)),
        status,
        premium:  num(get(r, dc, 'Premium', 8)),
        country:  str(get(r, dc, 'Country', 9)),
        office:   str(get(r, dc, 'Office', 10)),
        agent:    normalizeName(rawAgent),
        verifier: normalizeName(get(r, dc, 'Repitched By', 12)),
        saver:    normalizeName(get(r, dc, 'Overturned By', 13)),
        portal:   str(get(r, dc, 'Paid Through', 15)),
        city:     str(get(r, dc, 'City', 22)),
      };
    }).filter(Boolean);

    // ── VERIFICATION rows ─────────────────────────────────────────────────
    const verRows = dataRows.slice(1).map(r => {
      const rawStatus = str(get(r, dc, 'Status', 6));
      const status    = normalizeStatus(rawStatus);
      if (!status) return null;
      const verifier = normalizeName(get(r, dc, 'Repitched By', 12));
      const saver    = normalizeName(get(r, dc, 'Overturned By', 13));
      if (!verifier && !saver) return null;

      const rawYear  = get(r, dc, 'Year', 0);
      const rawDate  = str(get(r, dc, 'Date', 2));
      const year     = extractYear(rawYear) || extractYear(rawDate);

      return {
        year,
        month:    str(get(r, dc, 'Month', 1)),
        status,
        verifier,
        saver,
      };
    }).filter(Boolean);

    // ── TARGETS ───────────────────────────────────────────────────────────
    const tc = colMap(targetRows[0] || []);
    const targets = targetRows.slice(1).map(r => {
      const rawAgent = str(get(r, tc, 'Agent', 0));
      if (/\bUAG\s*$/i.test(rawAgent)) return null;
      return {
        agent:  normalizeName(rawAgent),
        month:  str(get(r, tc, 'Month', 1)),
        office: str(get(r, tc, 'Office', 2)),
        team:   str(get(r, tc, 'Team', 3)),
        target: num(get(r, tc, 'Target', 5)),
        city:   str(get(r, tc, 'City', 7)),
        year:   extractYear(get(r, tc, 'Year', 9)),
      };
    }).filter(Boolean).filter(r => r.agent && r.target > 0);

    const debugInfo = {
      dataHeaders:   (dataRows[0] || []).slice(0, 20),
      targetHeaders: (targetRows[0] || []).slice(0, 12),
      sampleSale:    sales.find(r => r.status === 'Paid' && r.premium > 0),
      sampleTarget:  targets[0],
      totalSales:    sales.length,
      totalVerRows:  verRows.length,
      totalTargets:  targets.length,
    };

    return NextResponse.json({ sales, targets, verRows, debugInfo });
  } catch (err) {
    console.error(err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
