import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SHEET_ID = '10NNmxFmAfQRIsfJ4QnZayleVI0WU2dJjPPs5d3BIVus';

const MANAGER_NAME = 'Abdelouahab Karroum';
const MANAGER_TEAMS = ['agadir upsellers', 'tangier upsellers'];
const MANAGER_BONUS_MAD = 2500;
const TOP_PERFORMER_BONUS_MAD = 500;
const REPITCH_RATE_MAD = 120;
const OVERTURN_RATE_MAD = 60;
const FX_RATE = 12.1; // GBP -> MAD

const REVENUE_STATUSES = ['paid', 'sfdp', 'scheduled', 'charge back', 'admin refund', 'manual refund'];
const SUCCESS_STATUSES = ['paid', 'sfdp', 'scheduled'];
const REVERSAL_STATUSES = ['charge back', 'admin refund', 'manual refund'];

const str = v => String(v ?? '').trim();
const num = v => { const n = parseFloat(str(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
const toYear = v => { const m = str(v).match(/(20\d{2})/); return m ? m[1] : ''; };
const normName = raw => str(raw).replace(/\s+UAG\s*$/i, '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const normStatus = raw => str(raw).toLowerCase();
const isHiddenAgent = name => /office|manager|claim\s*fee/i.test(name);

const STATUS_CANON = {
  paid: 'Paid', sfdp: 'SFDP', scheduled: 'Scheduled', 'charge back': 'Charge Back',
  'admin refund': 'Admin Refund', 'manual refund': 'Manual Refund',
  cancelled: 'Cancelled', 'payment fail': 'Payment Fail',
};
const canonicalStatus = raw => STATUS_CANON[normStatus(raw)] || null;

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
    const filterYear = searchParams.get('year') || '';
    const filterMonth = searchParams.get('month') || '';

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const api = google.sheets({ version: 'v4', auth });

    const [dataRows, targetRows] = await Promise.all([
      readRows(api, 'Data!A1:W13000'),
      readRows(api, 'Target_List!A1:K3000'),
    ]);

    const header = dataRows[0] || [];
    const idx = name => header.indexOf(name);
    const yearIdx = idx('Year'), monthIdx = idx('Month'), statusIdx = idx('Status'), premIdx = idx('Premium'),
          agentIdx = idx('Agent'), repIdx = idx('Repitched By'), overIdx = idx('Overturned By'),
          teamIdx = idx('Team'), cityIdx = idx('City'), officeIdx = idx('Office'), portalIdx = idx('Paid Through');

    const tHeader = targetRows[0] || [];
    const tIdx = name => tHeader.indexOf(name);
    const tAgentIdx = tIdx('Agent'), tMonthIdx = tIdx('Month'), tYearIdx = tIdx('Year'),
          tOfficeIdx = tIdx('Office'), tTeamIdx = tIdx('Team'), tCityIdx = tIdx('City'), tTargetIdx = tIdx('Target');

    // Years/months available for the filter dropdowns (whole dataset, not period-filtered)
    const years = [...new Set(dataRows.slice(1).map(r => r && toYear(r[yearIdx])).filter(Boolean))].sort();
    const months = [...new Set(dataRows.slice(1).map(r => r && str(r[monthIdx])).filter(Boolean))];

    // --- raw sales/targets rows, for pages that need row-level granularity (e.g. stats) ---
    const sales = [];
    for (const r of dataRows.slice(1)) {
      if (!r) continue;
      const year = toYear(r[yearIdx]);
      const month = str(r[monthIdx]);
      if (filterYear && year !== filterYear) continue;
      if (filterMonth && month !== filterMonth) continue;
      const status = canonicalStatus(r[statusIdx]);
      if (!status || status === 'Payment Fail' || status === 'Cancelled') continue;
      const agent = normName(r[agentIdx]);
      if (!agent) continue;
      sales.push({
        year, month, status,
        premium: num(r[premIdx]),
        office: str(r[officeIdx]),
        agent,
        portal: str(r[portalIdx] || ''),
        city: str(r[cityIdx] || ''),
      });
    }
    const verifierRows = [];
    for (const r of dataRows.slice(1)) {
      if (!r) continue;
      const year = toYear(r[yearIdx]);
      const month = str(r[monthIdx]);
      if (filterYear && year !== filterYear) continue;
      if (filterMonth && month !== filterMonth) continue;
      const status = canonicalStatus(r[statusIdx]);
      if (!status) continue;
      const repitchedBy = normName(r[repIdx]);
      const overturnedBy = normName(r[overIdx]);
      if (!repitchedBy && !overturnedBy) continue;
      verifierRows.push({ year, month, status, premium: num(r[premIdx]), repitchedBy, overturnedBy });
    }
    const allTargets = [];
    for (const t of targetRows.slice(1)) {
      if (!t) continue;
      const rawAgent = str(t[tAgentIdx]);
      if (!rawAgent || /\bUAG\s*$/i.test(rawAgent)) continue;
      const target = num(t[tTargetIdx]);
      if (target <= 0) continue;
      const tYear = toYear(t[tYearIdx]);
      const tMonth = str(t[tMonthIdx]);
      if (filterYear && tYear && tYear !== filterYear) continue;
      if (filterMonth && tMonth && tMonth !== filterMonth) continue;
      allTargets.push({
        agent: normName(rawAgent),
        month: tMonth, office: str(t[tOfficeIdx]),
        team: str(t[tTeamIdx]), target,
        city: str(t[tCityIdx]), year: tYear,
      });
    }

    if (!filterYear || !filterMonth) {
      return NextResponse.json({ years, months, sales, targets: allTargets, verifierRows, agents: [], verifiers: [], managerBonusEarned: false });
    }

    const rows = dataRows.slice(1).filter(r => r && str(r[yearIdx]) === filterYear && str(r[monthIdx]) === filterMonth);
    const targets = targetRows.slice(1).filter(r => r && str(r[tYearIdx]) === filterYear && str(r[tMonthIdx]) === filterMonth);

    // --- per-agent revenue, city/team metadata ---
    const agentRevenue = {}, agentCity = {}, agentTeam = {};
    for (const r of rows) {
      const status = normStatus(r[statusIdx]);
      const agent = normName(r[agentIdx]);
      if (!agent) continue;
      if (!agentCity[agent]) agentCity[agent] = str(r[cityIdx]) || str(r[officeIdx]);
      if (!agentTeam[agent]) agentTeam[agent] = str(r[teamIdx]);
      if (!REVENUE_STATUSES.includes(status)) continue;
      agentRevenue[agent] = (agentRevenue[agent] || 0) + num(r[premIdx]);
    }

    // --- per-agent target (max across duplicate/UAG rows, not summed) ---
    const agentTarget = {};
    for (const t of targets) {
      const agent = normName(t[tAgentIdx]);
      if (!agent) continue;
      agentTarget[agent] = Math.max(agentTarget[agent] || 0, num(t[tTargetIdx]));
      if (!agentTeam[agent]) agentTeam[agent] = str(t[tTeamIdx]);
    }

    // --- manager bonus: combined Agadir Upsellers + Tangier Upsellers team vs combined target ---
    let teamActual = 0, teamTarget2 = 0;
    for (const r of rows) {
      const status = normStatus(r[statusIdx]);
      if (!REVENUE_STATUSES.includes(status)) continue;
      if (MANAGER_TEAMS.includes(str(r[teamIdx]).toLowerCase())) teamActual += num(r[premIdx]);
    }
    for (const t of targets) {
      if (MANAGER_TEAMS.includes(str(t[tTeamIdx]).toLowerCase())) teamTarget2 += num(t[tTargetIdx]);
    }
    const managerBonusEarned = teamTarget2 > 0 && teamActual >= teamTarget2;
    const managerCommissionAmount = managerBonusEarned ? MANAGER_BONUS_MAD : 0;

    // --- agent commission table ---
    const allAgentNames = new Set([...Object.keys(agentRevenue), ...Object.keys(agentTarget)]);
    const agents = [];
    for (const agent of allAgentNames) {
      if (isHiddenAgent(agent)) continue;
      const revenue = agentRevenue[agent] || 0;
      const target = agentTarget[agent] || 0;
      const reachedPct = target > 0 ? (revenue / target) * 100 : null;
      let commission = 0;
      if (reachedPct !== null && revenue > 0) {
        const rate = reachedPct >= 200 ? 0.05 : reachedPct >= 150 ? 0.04 : 0.03;
        commission = revenue * rate * FX_RATE;
      }
      const managerCommission = agent === MANAGER_NAME ? managerCommissionAmount : 0;
      agents.push({
        agent, city: agentCity[agent] || '', team: agentTeam[agent] || '',
        revenue, target, reachedPct, commission, managerCommission,
        total: commission + managerCommission,
        isManager: agent === MANAGER_NAME,
      });
    }
    agents.sort((a, b) => b.revenue - a.revenue);

    // --- repitch / overturn bonuses (net successes minus reversals, floored at 0) ---
    const repitchNet = {}, overturnNet = {};
    for (const r of rows) {
      const status = normStatus(r[statusIdx]);
      const rep = normName(r[repIdx]);
      const over = normName(r[overIdx]);
      if (SUCCESS_STATUSES.includes(status)) {
        if (rep) repitchNet[rep] = (repitchNet[rep] || 0) + 1;
        if (over) overturnNet[over] = (overturnNet[over] || 0) + 1;
      } else if (REVERSAL_STATUSES.includes(status)) {
        if (rep) repitchNet[rep] = (repitchNet[rep] || 0) - 1;
        if (over) overturnNet[over] = (overturnNet[over] || 0) - 1;
      }
    }
    const repitchBonus = {}, overturnBonus = {};
    for (const [name, n] of Object.entries(repitchNet)) repitchBonus[name] = Math.max(n, 0) * REPITCH_RATE_MAD;
    for (const [name, n] of Object.entries(overturnNet)) overturnBonus[name] = Math.max(n, 0) * OVERTURN_RATE_MAD;

    // --- verifier net revenue, for Top Performer ranking ---
    const verifierRevenue = {};
    for (const r of rows) {
      const status = normStatus(r[statusIdx]);
      if (!REVENUE_STATUSES.includes(status)) continue;
      const amount = num(r[premIdx]);
      const names = new Set([normName(r[repIdx]), normName(r[overIdx])].filter(Boolean));
      for (const n of names) verifierRevenue[n] = (verifierRevenue[n] || 0) + amount;
    }
    const topEntry = Object.entries(verifierRevenue).sort((a, b) => b[1] - a[1])[0];
    const topName = topEntry ? topEntry[0] : null;

    const allVerifierNames = new Set([...Object.keys(repitchBonus), ...Object.keys(overturnBonus)]);
    const verifiers = [];
    for (const name of allVerifierNames) {
      const repitch = repitchBonus[name] || 0;
      const overturn = overturnBonus[name] || 0;
      const topPerformerBonus = name === topName ? TOP_PERFORMER_BONUS_MAD : 0;
      const total = repitch + overturn + topPerformerBonus;
      if (total === 0) continue;
      verifiers.push({ name, repitch, overturn, topPerformerBonus, total });
    }
    verifiers.sort((a, b) => b.total - a.total);

    return NextResponse.json({ years, months, sales, targets: allTargets, verifierRows, agents, verifiers, managerBonusEarned });

  } catch (err) {
    console.error('API Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
