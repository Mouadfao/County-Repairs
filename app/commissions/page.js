'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

// ── helpers ────────────────────────────────────────────────────────────────
const MONTH_ORDER = ['01.January','02.February','03.March','04.April','05.May','06.June',
  '07.July','08.August','09.September','10.October','11.November','12.December'];
const shortM  = m => m.replace(/^\d+\./, '').slice(0, 3);
const sortM   = arr => [...new Set(arr)].sort((a,b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));

const fmtGBP  = n => { const s=n<0?'-':''; return s+'£'+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}); };
const fmtMAD  = n => { const s=n<0?'-':''; return s+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' MAD'; };
const fmtPct  = n => n === null ? 'No target' : n.toFixed(1) + '%';

const MANAGER = 'Abdelouahab Karroum';

// Agents to hide from tables (but still count in revenue totals)
const isHiddenAgent = name => /office|manager|claim\s*fee/i.test(name);

// Revenue statuses
const countsRev = s => ['Paid','SFDP','Charge Back','Admin Refund','Manual Refund'].includes(s);
// Verification scoring
const verScore  = s => {
  if (['Paid','SFDP','Scheduled'].includes(s)) return 1;
  if (s === 'Payment Fail') return 0;
  if (['Manual Refund','Admin Refund','Charge Back'].includes(s)) return -1;
  return 0;
};

// Commission rate — no target = base 3% rate
const commissionMAD = (revenue, pct) => {
  if (revenue <= 0) return 0;
  const rate = pct !== null && pct >= 200 ? 0.05 : pct !== null && pct >= 150 ? 0.04 : 0.03;
  return revenue * rate * 12.1;
};

const C = { blue:'#2563eb', green:'#16a34a', red:'#dc2626', amber:'#d97706', purple:'#7c3aed', teal:'#0891b2', slate:'#64748b' };

const card  = { background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.07)' };
const thSt  = { padding:'9px 12px', textAlign:'left', color:'#64748b', fontWeight:700, fontSize:11, whiteSpace:'nowrap', borderBottom:'2px solid #e2e8f0', background:'#F8FAFC' };
const tdSt  = (i) => ({ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', background: i%2===0 ? '#fff' : '#F8FAFC', fontSize:13 });

// ── component ──────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const [raw,     setRaw]     = useState({ sales:[], targets:[], verRows:[] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [updated, setUpdated] = useState('');

  // Year + Month are required — never "All time"
  const [fYear,  setFYear]  = useState('');
  const [fMonth, setFMonth] = useState('');
  const [fCity,  setFCity]  = useState('All');
  const [fAgent, setFAgent] = useState('All');

  async function load() {
    setLoading(true); setError('');
    try {
      const j = await fetch('/api/sheets').then(r => r.json());
      if (j.error) throw new Error(j.error);
      setRaw(j);
      setUpdated(new Date().toLocaleTimeString());

      // Default to latest year + latest month
      const years  = [...new Set(j.sales.map(r=>r.year).filter(Boolean))].sort().reverse();
      const months = sortM([...new Set(j.sales.map(r=>r.month).filter(Boolean))]);
      if (years[0])  setFYear(years[0]);
      if (months[months.length-1]) setFMonth(months[months.length-1]);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const { sales, targets, verRows } = raw;

  // ── filter options ─────────────────────────────────────────────────────
  const years  = useMemo(() => [...new Set(sales.map(r=>r.year).filter(Boolean))].sort().reverse(), [sales]);
  const months = useMemo(() => sortM(sales.filter(r=>!fYear||r.year===fYear).map(r=>r.month).filter(Boolean)), [sales, fYear]);
  const cities = useMemo(() => [...new Set(sales.map(r=>r.city||r.office).filter(Boolean))].sort(), [sales]);
  const agents = useMemo(() => [...new Set(sales.map(r=>r.agent).filter(Boolean))].sort(), [sales]);

  // ── filtered sales ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!fYear || !fMonth) return [];
    return sales.filter(r =>
      r.year  === fYear  &&
      r.month === fMonth &&
      (fCity  === 'All' || r.city === fCity || r.office === fCity) &&
      (fAgent === 'All' || r.agent === fAgent)
    );
  }, [sales, fYear, fMonth, fCity, fAgent]);

  // ── filtered verRows ───────────────────────────────────────────────────
  const filteredVer = useMemo(() => {
    if (!fYear || !fMonth) return [];
    return verRows.filter(r => r.year === fYear && r.month === fMonth);
  }, [verRows, fYear, fMonth]);

  // ── filtered targets ───────────────────────────────────────────────────
  const filteredTargets = useMemo(() =>
    // Match year OR blank year — handles cases where year cell is empty in Target_List
    targets.filter(t => (!fYear || !t.year || t.year === fYear) && (!fMonth || t.month === fMonth)),
  [targets, fYear, fMonth]);

  const getAgentTarget = (agentName) => {
    const fromSheet = filteredTargets.filter(t => t.agent === agentName).reduce((s,t) => s+t.target, 0);
    // Hardcoded fallback for agents missing from Target_List
    if (fromSheet === 0 && agentName === 'Wahiba Chajri' && fMonth === '03.March' && fYear === '2026') return 5000;
    return fromSheet;
  };

  // ══════════════════════════════════════════════════════════════════════
  // TABLE 1 — UPSELLERS COMMISSION
  // ══════════════════════════════════════════════════════════════════════
  const upsellers = useMemo(() => {
    // Group filtered sales by agent, summing premium (CB/refunds already negative)
    const map = {};
    filtered.filter(r => countsRev(r.status)).forEach(r => {
      if (!map[r.agent]) map[r.agent] = { agent:r.agent, revenue:0 };
      map[r.agent].revenue += r.premium;
    });

    // Remove agents with zero or negative net revenue
    const rows = Object.values(map).filter(a => a.revenue > 0).map(a => {
      const tgt = getAgentTarget(a.agent);
      const pct = tgt > 0 ? (a.revenue / tgt * 100) : null;
      return { ...a, target:tgt, pct, commission: commissionMAD(a.revenue, pct) };
    }).sort((a,b) => b.revenue - a.revenue);



    // Remove hidden agents from display (office/Manager/Claim Fee)
    // Note: their revenue is already included in totals above

    // Separate: all rows for team total, visible rows for display
    const visibleRows = rows.filter(r => !isHiddenAgent(r.agent));

    // Check if whole team reached 100% (use ALL rows including hidden)
    const totalRev = rows.reduce((s,r) => s+r.revenue, 0);
    const totalTgt = filteredTargets.reduce((s,t) => s+t.target, 0);
    const teamReached = totalTgt > 0 && totalRev >= totalTgt;

    // Add 2500 MAD bonus to manager if team reached 100%
    return visibleRows.map(r => ({
      ...r,
      isManager: r.agent === MANAGER,
      commission: r.agent === MANAGER && teamReached ? r.commission + 2500 : r.commission,
      teamBonus: r.agent === MANAGER && teamReached,
    }));
  }, [filtered, filteredTargets]);

  // ══════════════════════════════════════════════════════════════════════
  // TABLE 2 — VERIFICATION AGENTS COMMISSION
  // ══════════════════════════════════════════════════════════════════════
  const verAgents = useMemo(() => {
    if (filteredVer.length === 0) return [];

    // Collect all unique ver agent names (from col M and col N)
    const nameSet = new Set();
    filteredVer.forEach(r => {
      if (r.verifier) nameSet.add(r.verifier);
      if (r.saver)    nameSet.add(r.saver);
    });

    const rows = [...nameSet].filter(n => n && n.length > 1).map(name => {
      // Repitched Leads: rows where col M = this agent
      const repitched = filteredVer
        .filter(r => r.verifier === name)
        .reduce((s, r) => s + verScore(r.status), 0);

      // Overturned Payments: rows where col N = this agent
      const overturned = filteredVer
        .filter(r => r.saver === name)
        .reduce((s, r) => s + verScore(r.status), 0);

      return { name, repitched, overturned, total: repitched + overturned };
    });

    // Top performer bonus
    const maxTotal = Math.max(...rows.map(r => r.total));
    const topCount = rows.filter(r => r.total === maxTotal && maxTotal > 0).length;
    const bonus    = topCount === 1 ? 500 : topCount === 2 ? 250 : 0;

    return rows.map(r => {
      const isTop      = r.total === maxTotal && maxTotal > 0;
      const topBonus   = isTop ? bonus : 0;
      const commission = (120 * r.repitched) + (60 * r.overturned) + topBonus;
      return { ...r, topBonus, commission };
    }).sort((a,b) => b.commission - a.commission);
  }, [filteredVer]);

  // ── totals ─────────────────────────────────────────────────────────────
  const totalUpsellComm = upsellers.reduce((s,r) => s+r.commission, 0);
  const totalVerComm    = verAgents.reduce((s,r) => s+r.commission, 0);

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#F1F5F9', fontFamily:'system-ui,sans-serif' }}>

      {/* HEADER */}
      <div style={{ background:'#0f172a', color:'#fff', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Link href="/" style={{ color:'#64748b', textDecoration:'none', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
            <span>🏢</span><span>Portal</span><span style={{ margin:'0 4px' }}>/</span>
          </Link>
          <div style={{ width:30, height:30, borderRadius:7, background:C.purple, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>💰</div>
          <div>
            <div style={{ fontSize:16, fontWeight:700 }}>County Repairs — Commissions</div>
            <div style={{ fontSize:10, opacity:.5, marginTop:1 }}>{updated ? `Live · ${updated}` : 'Loading...'}</div>
          </div>
        </div>
        <button onClick={load} style={{ padding:'5px 14px', background:C.purple, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:500 }}>⟳ Refresh</button>
      </div>

      <div style={{ padding:'16px 24px' }}>

        {loading && <div style={{ textAlign:'center', padding:'80px', color:'#64748b' }}><div style={{ fontSize:40 }}>⏳</div><p>Loading…</p></div>}
        {error   && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:14, color:C.red, fontSize:13 }}><b>Error:</b> {error}</div>}

        {!loading && !error && (<>

        {/* ── FILTERS ── */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center', background:'#fff', padding:'10px 14px', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <span style={{ fontSize:12, color:C.red, fontWeight:600 }}>⚠ Year and Month required</span>

          {/* Year — required */}
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
            Year
            <select value={fYear} onChange={e => { setFYear(e.target.value); setFMonth(''); }}
              style={{ padding:'4px 7px', borderRadius:6, border:`1.5px solid ${!fYear?C.red:'#e2e8f0'}`, fontSize:12, background:'#fff', cursor:'pointer', minWidth:80 }}>
              <option value="">— select —</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          {/* Month — required */}
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
            Month
            <select value={fMonth} onChange={e => setFMonth(e.target.value)}
              style={{ padding:'4px 7px', borderRadius:6, border:`1.5px solid ${!fMonth?C.red:'#e2e8f0'}`, fontSize:12, background:'#fff', cursor:'pointer', minWidth:90 }}>
              <option value="">— select —</option>
              {months.map(m => <option key={m} value={m}>{shortM(m)}</option>)}
            </select>
          </label>

          {/* City */}
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
            City
            <select value={fCity} onChange={e => setFCity(e.target.value)}
              style={{ padding:'4px 7px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:12, background:'#fff', cursor:'pointer', minWidth:80 }}>
              {['All',...cities].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {/* Agent */}
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
            Agent
            <select value={fAgent} onChange={e => setFAgent(e.target.value)}
              style={{ padding:'4px 7px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:12, background:'#fff', cursor:'pointer', minWidth:120 }}>
              {['All',...agents].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <div style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8' }}>
            {fYear && fMonth ? `${shortM(fMonth)} ${fYear}` : 'Select year & month'}
          </div>
        </div>

        {(!fYear || !fMonth) && (
          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10, padding:'16px 20px', color:'#9a3412', fontSize:13, marginBottom:16 }}>
            👆 Please select a <strong>Year</strong> and <strong>Month</strong> above to view commissions.
          </div>
        )}

        {fYear && fMonth && (<>

        {/* ── SUMMARY CARDS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:16 }}>
          {[
            { label:'Total Upseller Commissions', val:fmtMAD(totalUpsellComm), color:C.blue },
            { label:'Total Verification Commissions', val:fmtMAD(totalVerComm), color:C.teal },
            { label:'Total Commissions', val:fmtMAD(totalUpsellComm+totalVerComm), color:C.purple },
            { label:'Agents Paid', val:upsellers.length, color:C.green },
            { label:'Verification Agents', val:verAgents.length, color:C.amber },
          ].map(({ label, val, color }) => (
            <div key={label} style={card}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* TABLE 1 — UPSELLERS COMMISSION                        */}
        {/* ══════════════════════════════════════════════════════ */}
        <div style={{ ...card, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>💼 Upsellers Commission</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                {shortM(fMonth)} {fYear} · Commission = Revenue × rate × 12.1 &nbsp;|&nbsp; &lt;150%: 3% · 150–200%: 4% · ≥200%: 5%
              </div>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:C.blue }}>{fmtMAD(totalUpsellComm)}</div>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['#','Year','Month','Agent','Total Revenue','Target','% Reached','Commission (MAD)',''].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upsellers.length === 0 && (
                  <tr><td colSpan={9} style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:13 }}>No data for this period</td></tr>
                )}
                {upsellers.map((a, i) => {
                  const pctColor = a.pct === null ? C.slate : a.pct >= 200 ? C.purple : a.pct >= 150 ? C.green : a.pct >= 100 ? C.teal : a.pct >= 70 ? C.amber : C.red;
                  return (
                    <tr key={a.agent}>
                      <td style={tdSt(i)}><span style={{ color:'#94a3b8', fontWeight:600 }}>{i+1}</span></td>
                      <td style={tdSt(i)}>{fYear}</td>
                      <td style={tdSt(i)}>{shortM(fMonth)}</td>
                      <td style={tdSt(i)}>
                        <span style={{ fontWeight:600, color:'#1e293b' }}>{a.agent}</span>
                        {a.isManager && <span style={{ marginLeft:6, fontSize:10, background:'#EDE9FE', color:C.purple, padding:'2px 7px', borderRadius:4, fontWeight:700 }}>Manager</span>}
                        {a.teamBonus && <span style={{ marginLeft:4, fontSize:10, background:'#FEF3C7', color:C.amber, padding:'2px 7px', borderRadius:4, fontWeight:700 }}>+2500 MAD team bonus</span>}
                      </td>
                      <td style={{ ...tdSt(i), fontWeight:700, color:C.blue }}>{fmtGBP(a.revenue)}</td>
                      <td style={{ ...tdSt(i), color:'#64748b' }}>{a.target > 0 ? fmtGBP(a.target) : '—'}</td>
                      <td style={{ ...tdSt(i), fontWeight:700, color:pctColor }}>{fmtPct(a.pct)}</td>
                      <td style={{ ...tdSt(i), fontWeight:800, color:C.purple, fontSize:14 }}>{fmtMAD(Math.round(a.commission))}</td>
                      <td style={{ ...tdSt(i), minWidth:90 }}>
                        {a.pct !== null && (
                          <div style={{ height:6, background:'#e2e8f0', borderRadius:3 }}>
                            <div style={{ height:'100%', width:Math.min(a.pct,100)+'%', background:pctColor, borderRadius:3 }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {upsellers.length > 0 && (
                <tfoot>
                  <tr style={{ background:'#F1F5F9' }}>
                    <td colSpan={7} style={{ padding:'9px 12px', fontWeight:700, fontSize:12, color:'#0f172a' }}>TOTAL</td>
                    <td style={{ padding:'9px 12px', fontWeight:800, color:C.purple, fontSize:14 }}>{fmtMAD(Math.round(totalUpsellComm))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* TABLE 2 — VERIFICATION AGENTS COMMISSION              */}
        {/* ══════════════════════════════════════════════════════ */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>🔍 Verification Agents Commission</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                {shortM(fMonth)} {fYear} · Commission = (120 × Repitched) + (60 × Overturned) + Top Bonus &nbsp;|&nbsp; Paid/SFDP/Scheduled=+1 · Fail=0 · CB/Refund=−1
              </div>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:C.teal }}>{fmtMAD(totalVerComm)}</div>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['#','Year','Month','Verification Agent','Overturned Payments','Repitched Leads','Top Performer Bonus','Commission (MAD)'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {verAgents.length === 0 && (
                  <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:13 }}>No verification data for this period</td></tr>
                )}
                {verAgents.map((a, i) => (
                  <tr key={a.name}>
                    <td style={tdSt(i)}><span style={{ color:'#94a3b8', fontWeight:600 }}>{i+1}</span></td>
                    <td style={tdSt(i)}>{fYear}</td>
                    <td style={tdSt(i)}>{shortM(fMonth)}</td>
                    <td style={tdSt(i)}>
                      <span style={{ fontWeight:600, color:'#1e293b' }}>{a.name}</span>
                      {a.topBonus > 0 && <span style={{ marginLeft:6, fontSize:10, background:'#FEF3C7', color:C.amber, padding:'2px 7px', borderRadius:4, fontWeight:700 }}>🏆 Top Performer</span>}
                    </td>
                    <td style={{ ...tdSt(i), fontWeight:700, color: a.overturned >= 0 ? C.green : C.red, textAlign:'center' }}>{a.overturned >= 0 ? '+' : ''}{a.overturned}</td>
                    <td style={{ ...tdSt(i), fontWeight:700, color: a.repitched >= 0 ? C.blue : C.red, textAlign:'center' }}>{a.repitched >= 0 ? '+' : ''}{a.repitched}</td>
                    <td style={{ ...tdSt(i), textAlign:'center', fontWeight:700, color: a.topBonus > 0 ? C.amber : '#94a3b8' }}>
                      {a.topBonus > 0 ? fmtMAD(a.topBonus) : '—'}
                    </td>
                    <td style={{ ...tdSt(i), fontWeight:800, color:C.teal, fontSize:14 }}>{fmtMAD(Math.round(a.commission))}</td>
                  </tr>
                ))}
              </tbody>
              {verAgents.length > 0 && (
                <tfoot>
                  <tr style={{ background:'#F1F5F9' }}>
                    <td colSpan={7} style={{ padding:'9px 12px', fontWeight:700, fontSize:12, color:'#0f172a' }}>TOTAL</td>
                    <td style={{ padding:'9px 12px', fontWeight:800, color:C.teal, fontSize:14 }}>{fmtMAD(Math.round(totalVerComm))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        </>)}
        </>)}
      </div>
    </div>
  );
}
