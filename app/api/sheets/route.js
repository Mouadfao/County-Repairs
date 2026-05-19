import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SHEET_ID = '1ci6vbrkWOHkq2k-HBhFOdOBprusA_hlw09-B1VCeZe4';

const str    = v => String(v ?? '').trim();
const num    = v => { const n = parseFloat(str(v).replace(/[^\d.-]/g,'')); return isNaN(n)?0:n; };
const toYear = v => { const m = str(v).match(/(20\d{2})/); return m?m[1]:''; };
const normName = raw => str(raw).replace(/\s+UAG\s*$/i,'').trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const normStatus = raw => {
  const s = str(raw).toLowerCase();
  if(s==='paid') return 'Paid';
  if(s==='sfdp') return 'SFDP';
  if(s==='scheduled') return 'Scheduled';
  if(s==='charge back') return 'Charge Back';
  if(s==='admin refund') return 'Admin Refund';
  if(s==='manual refund') return 'Manual Refund';
  if(s==='cancelled') return 'Cancelled';
  if(s==='payment fail') return 'Payment Fail';
  return null;
};

async function readRows(api, range) {
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return res.data.values || [];
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterYear  = searchParams.get('year')  || '';
    const filterMonth = searchParams.get('month') || '';

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({ credentials, scopes:['https://www.googleapis.com/auth/spreadsheets'] });
    const api  = google.sheets({ version:'v4', auth });

    // Read Target_List and periods in parallel with first data batch
    const [batch1, batch2, batch3, targetData, periodsA, periodsB] = await Promise.all([
      readRows(api, 'Data!A1:W4000'),
      readRows(api, 'Data!A4001:W8000'),
      readRows(api, 'Data!A8001:W13000'),
      readRows(api, 'Target_List!A:K'),
      readRows(api, 'Data!A:A'),
      readRows(api, 'Data!B:B'),
    ]);

    const dataRows = [...batch1, ...batch2, ...batch3];
    const header   = dataRows[0] || [];

    const sales   = [];
    const verRows = [];

    for(let i=1; i<dataRows.length; i++){
      const r = dataRows[i];
      if(!r||r.length<7) continue;

      const year  = toYear(r[0]);
      const month = str(r[1]);

      if(filterYear  && year  !== filterYear)  continue;
      if(filterMonth && month !== filterMonth) continue;

      const status   = normStatus(r[6]);
      if(!status) continue;

      const agent    = normName(r[11]||'');
      const verifier = normName(r[12]||'');
      const saver    = normName(r[13]||'');

      if(agent && status!=='Payment Fail' && status!=='Cancelled'){
        sales.push({
          year, month, status,
          premium:  num(r[8]),
          office:   str(r[10]),
          agent, verifier, saver,
          portal:   str(r[15]||''),
          city:     str(r[22]||''),
        });
      }
      if(verifier||saver){
        verRows.push({year,month,status,verifier,saver});
      }
    }

    // Targets
    const targets = [];
    for(let i=1; i<targetData.length; i++){
      const r = targetData[i];
      if(!r) continue;
      const rawAgent = str(r[0]);
      if(!rawAgent||/\bUAG\s*$/i.test(rawAgent)) continue;
      const target = num(r[5]);
      if(target<=0) continue;
      const tYear  = toYear(r[9]);
      const tMonth = str(r[1]);
      if(filterYear  && tYear  && tYear  !== filterYear)  continue;
      if(filterMonth && tMonth && tMonth !== filterMonth) continue;
      targets.push({
        agent:  normName(rawAgent),
        month:  tMonth, office: str(r[2]),
        team:   str(r[3]), target,
        city:   str(r[7]), year: tYear,
      });
    }

    // Available years/months
    const years  = [...new Set((periodsA[0]||[]).slice(1).map(toYear).filter(Boolean))].sort();
    const months = [...new Set((periodsB[0]||[]).slice(1).map(v=>str(v)).filter(Boolean))];

    return NextResponse.json({
      sales, targets, verRows, years, months,
      debugInfo:{
        totalSales:   sales.length,
        totalVerRows: verRows.length,
        totalTargets: targets.length,
        totalDataRows: dataRows.length,
        filterYear, filterMonth,
        sampleMay2026Abdelouahab: filterYear==='2026'&&filterMonth==='05.May'
          ? sales.filter(s=>s.agent.toLowerCase().includes('abdelouahab')&&['Paid','SFDP','Charge Back','Admin Refund','Manual Refund'].includes(s.status))
              .reduce((a,s)=>({count:a.count+1,total:a.total+s.premium}),{count:0,total:0})
          : null,
      },
    });

  } catch(err) {
    console.error('API Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
