import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SPREADSHEET_ID = '1ci6vbrkWOHkq2k-HBhFOdOBprusA_hlw09-B1VCeZe4';

const normalizeName = raw =>
  String(raw || '').replace(/\s+UAG\s*$/i, '').trim()
    .toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const extractYear = v => {
  const s = String(v || '').trim();
  const match = s.match(/(20\d{2})/);
  if (match) return match[1];
  const n = parseFloat(s);
  if (!isNaN(n) && n > 2000 && n < 2100) return String(Math.round(n));
  return '';
};

const str = v => String(v || '').trim();
const num = v => { const n = parseFloat(String(v||'').replace(/[^\d.-]/g,'')); return isNaN(n)?0:n; };

export async function GET() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const api  = google.sheets({ version: 'v4', auth });

    const res = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Target_List',
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = res.data.values || [];
    const headers = rows[0] || [];

    // Find col indices
    const agentCol = headers.findIndex(h => str(h).toLowerCase() === 'agent');
    const monthCol = headers.findIndex(h => str(h).toLowerCase() === 'month');
    const yearCol  = headers.findIndex(h => str(h).toLowerCase() === 'year');
    const targetCol= headers.findIndex(h => str(h).toLowerCase() === 'target');

    // Show ALL rows with any March month — raw values
    const march2026 = rows.slice(1)
      .filter(r => str(r[monthCol] || '').toLowerCase().includes('march'))
      .map(r => ({
        rawAgent: str(r[agentCol] || ''),
        normalizedAgent: normalizeName(str(r[agentCol] || '')),
        rawYear: str(r[yearCol] || ''),
        rawMonth: str(r[monthCol] || ''),
        target: num(r[targetCol] || '0'),
      }));

    // Also get the agent names from Data sheet for comparison
    const dataRes = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data!A1:L10',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const dataHeaders = dataRes.data.values?.[0] || [];
    const agentColData = dataHeaders.findIndex(h => str(h).toLowerCase() === 'agent');
    const yearColData  = dataHeaders.findIndex(h => str(h).toLowerCase() === 'year');

    // Get a few sample rows from Data for March 2026
    const dataFull = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Data',
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const dataRows = dataFull.data.values || [];
    const sampleSales = dataRows.slice(1)
      .filter(r => str(r[1]||'').includes('March') && str(r[agentColData]||'').toLowerCase().includes('wahiba'))
      .slice(0, 3)
      .map(r => ({
        rawYear: str(r[yearColData] || ''),
        extractedYear: extractYear(str(r[yearColData] || '')),
        rawMonth: str(r[1] || ''),
        rawAgent: str(r[agentColData] || ''),
        normalizedAgent: normalizeName(str(r[agentColData] || '')),
      }));

    return NextResponse.json({
      message: 'Debug data — check march2026Targets and sampleAgentSales',
      headers: { agentCol, monthCol, yearCol, targetCol },
      march2026Targets: march2026,
      sampleAgentSalesData: sampleSales,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
