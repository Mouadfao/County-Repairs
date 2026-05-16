'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

const MONTH_ORDER = ['01.January','02.February','03.March','04.April','05.May','06.June',
  '07.July','08.August','09.September','10.October','11.November','12.December'];
const shortM  = m => m.replace(/^\d+\./, '').slice(0, 3);
const sortM   = arr => [...new Set(arr)].sort((a,b) => MONTH_ORDER.indexOf(a)-MONTH_ORDER.indexOf(b));
const fmtGBP  = n => { const s=n<0?'-':''; return s+'£'+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}); };
const fmtMAD  = n => { const s=n<0?'-':''; return s+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' MAD'; };
const fmtPct  = n => n === null ? 'No target' : n.toFixed(1) + '%';
const MANAGER = 'Abdelouahab Karroum';
const isHiddenAgent = name => /office|manager|claim\s*fee/i.test(name);

const countsRev = s => ['Paid','SFDP','Charge Back','Admin Refund','Manual Refund'].includes(s);
const verScore  = s => {
  if (['Paid','SFDP','Scheduled'].includes(s)) return 1;
  if (s === 'Payment Fail') return 0;
  if (['Manual Refund','Admin Refund','Charge Back'].includes(s)) return -1;
  return 0;
};
const commissionMAD = (revenue, pct) => {
  if (revenue <= 0) return 0;
  const rate = pct !== null && pct >= 200 ? 0.05 : pct !== null && pct >= 150 ? 0.04 : 0.03;
  return revenue * rate * 12.1;
};

const C = { blue:'#2563eb', green:'#16a34a', red:'#dc2626', amber:'#d97706', purple:'#7c3aed', teal:'#0891b2', slate:'#64748b' };
const card  = { background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.07)' };
const thSt  = { padding:'9px 12px', textAlign:'left', color:'#64748b', fontWeight:700, fontSize:11, whiteSpace:'nowrap', borderBottom:'2px solid #e2e8f0', background:'#F8FAFC' };
const tdSt  = i => ({ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', background: i%2===0 ? '#fff' : '#F8FAFC', fontSize:13 });

export default function CommissionsPage() {
  const [raw,     setRaw]     = useState({ sales:[], targets:[], verRows:[] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [updated, setUpdated] = useState('');
  const [userRole, setUserRole] = useState('admin');

  const [fYear,  setFYear]  = useState('');
  const [fMonth, setFMonth] = useState('');
  const [fCity,  setFCity]  = useState('All');
  const [fAgent, setFAgent] = useState('All');

  // Get role from server
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.role) setUserRole(d.role); })
      .catch(() => {});
  }, []);

  const isAdmin               = userRole === 'admin' || userRole === 'super_admin';
  const isUpsellersManager    = userRole === 'upsellers_manager';
  const isVerificationManager = userRole === 'verification_manager';

  // What each role can see
  const showUpsellersTable   = isAdmin || isUpsellersManager;
  const showVerTable         = isAdmin || isUpsellersManager || isVerificationManager;
  const showTopCards         = isAdmin || isUpsellersManager;
  const showVerCommissionCol = isAdmin || isVerificationManager; // Ver manager sees commission
  const showVerBonusCol      = isAdmin || isVerificationManager; // Ver manager sees bonus
  const showVerTotalCard     = isAdmin;
  const showUpsellTotalCard  = isAdmin || isUpsellersManager;

  async function load() {
    setLoading(true); setError('');
    try {
      const j = await fetch('/api/sheets').then(r => r.json());
      if (j.error) throw new Error(j.error);
      setRaw(j);
      setUpdated(new Date().toLocaleTimeString());
      const years  = [...new Set(j.sales.map(r=>r.year).filter(Boolean))].sort().reverse();
      const months = sortM([...new Set(j.sales.map(r=>r.month).filter(Boolean))]);
      if (years[0])  setFYear(years[0]);
      if (months[months.length-1]) setFMonth(months[months.length-1]);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const { sales, targets, verRows } = raw;

  const years  = useMemo(() => [...new Set(sales.map(r=>r.year).filter(Boolean))].sort().reverse(), [sales]);
  const months = useMemo(() => sortM(sales.filter(r=>!fYear||r.year===fYear).map(r=>r.month).filter(Boolean)), [sales, fYear]);
  const cities = useMemo(() => [...new Set(sales.map(r=>r.city||r.office).filter(Boolean))].sort(), [sales]);
  const agents = useMemo(() => [...new Set(sales.map(r=>r.agent).filter(Boolean))].sort(), [sales]);

  // Upsellers manager: only agents in "Upsellers" teams
  const filteredTargets = useMemo(() =>
    targets.filter(t => (!fYear||!t.year||t.year===fYear) && (!fMonth||t.month===fMonth)),
  [targets, fYear, fMonth]);

  const allowedAgents = useMemo(() => {
    if (!isUpsellersManager) return null;
    const names = new Set();
    filteredTargets
      .filter(t => t.team && t.team.toLowerCase().includes('upsellers'))
      .forEach(t => names.add(t.agent));
    return names;
  }, [isUpsellersManager, filteredTargets]);

  const filtered = useMemo(() => {
    if (!fYear || !fMonth) return [];
    return sales.filter(r =>
      r.year  === fYear  &&
      r.month === fMonth &&
      (fCity  === 'All' || r.city === fCity || r.office === fCity) &&
      (fAgent === 'All' || r.agent === fAgent) &&
      (!allowedAgents || allowedAgents.has(r.agent))
    );
  }, [sales, fYear, fMonth, fCity, fAgent, allowedAgents]);

  const filteredVer = useMemo(() => {
    if (!fYear || !fMonth) return [];
    return verRows.filter(r => r.year === fYear && r.month === fMonth);
  }, [verRows, fYear, fMonth]);

  const getAgentTarget = (agentName) => {
    const fromSheet = filteredTargets.filter(t => t.agent === agentName).reduce((s,t) => s+t.target, 0);
    if (fromSheet === 0 && agentName === 'Wahiba Chajri' && fMonth === '03.March' && fYear === '2026') return 5000;
    return fromSheet;
  };

  // ── UPSELLERS TABLE ────────────────────────────────────────────────────
  const upsellers = useMemo(() => {
    const map = {};
    filtered.filter(r => countsRev(r.status) && !isHiddenAgent(r.agent)).forEach(r => {
      if (!map[r.agent]) map[r.agent] = { agent:r.agent, revenue:0 };
      map[r.agent].revenue += r.premium;
    });

    const visibleRows = Object.values(map).filter(a => a.revenue > 0 && !isHiddenAgent(a.agent));
    const totalRev = visibleRows.reduce((s,r) => s+r.revenue, 0);
    const totalTgt = filteredTargets
      .filter(t => !allowedAgents || allowedAgents.has(t.agent))
      .reduce((s,t) => s+t.target, 0);
    const teamReached = totalTgt > 0 && totalRev >= totalTgt;

    return visibleRows.map(a => {
      const tgt = getAgentTarget(a.agent);
      const pct = tgt > 0 ? (a.revenue / tgt * 100) : null;
      const comm = commissionMAD(a.revenue, pct);
      return {
        ...a, target:tgt, pct, isManager: a.agent === MANAGER,
        commission: a.agent === MANAGER && teamReached ? comm + 2500 : comm,
        teamBonus: a.agent === MANAGER && teamReached,
      };
    }).sort((a,b) => b.revenue - a.revenue);
  }, [filtered, filteredTargets, allowedAgents]);

  // ── VERIFICATION TABLE ─────────────────────────────────────────────────
  const verAgents = useMemo(() => {
    if (filteredVer.length === 0) return [];
    const nameSet = new Set();
    filteredVer.forEach(r => {
      if (r.verifier) nameSet.add(r.verifier);
      if (r.saver)    nameSet.add(r.saver);
    });
    const rows = [...nameSet].filter(n => n && n.length > 1).map(name => {
      const repitched  = filteredVer.filter(r => r.verifier === name).reduce((s,r) => s+verScore(r.status), 0);
      const overturned = filteredVer.filter(r => r.saver    === name).reduce((s,r) => s+verScore(r.status), 0);
      return { name, repitched, overturned, total: repitched + overturned };
    });
    const maxTotal = Math.max(...rows.map(r => r.total));
    const topCount = rows.filter(r => r.total === maxTotal && maxTotal > 0).length;
    const bonus    = topCount === 1 ? 500 : topCount === 2 ? 250 : 0;
    return rows.map(r => {
      const isTop    = r.total === maxTotal && maxTotal > 0;
      const topBonus = isTop ? bonus : 0;
      const commission = (120 * r.repitched) + (60 * r.overturned) + topBonus;
      return { ...r, topBonus, commission };
    }).sort((a,b) => b.commission - a.commission);
  }, [filteredVer]);

  const totalUpsellComm = upsellers.reduce((s,r) => s+r.commission, 0);
  const totalVerComm    = verAgents.reduce((s,r) => s+r.commission, 0);

  // Verification table title depends on role
  const verTableTitle = isAdmin ? '🔍 Verification Agents Commission' : '🔍 Verification Agents Stats';

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

        {/* FILTERS */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center', background:'#fff', padding:'10px 14px', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <span style={{ fontSize:12, color:C.red, fontWeight:600 }}>⚠ Year and Month required</span>

          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
            Year
            <select value={fYear} onChange={e => { setFYear(e.target.value); setFMonth(''); }}
              style={{ padding:'4px 7px', borderRadius:6, border:`1.5px solid ${!fYear?C.red:'#e2e8f0'}`, fontSize:12, background:'#fff', cursor:'pointer', minWidth:80 }}>
              <option value="">— select —</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
            Month
            <select value={fMonth} onChange={e => setFMonth(e.target.value)}
              style={{ padding:'4px 7px', borderRadius:6, border:`1.5px solid ${!fMonth?C.red:'#e2e8f0'}`, fontSize:12, background:'#fff', cursor:'pointer', minWidth:90 }}>
              <option value="">— select —</option>
              {months.map(m => <option key={m} value={m}>{shortM(m)}</option>)}
            </select>
          </label>

          {!isVerificationManager && (
            <>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
                City
                <select value={fCity} onChange={e => setFCity(e.target.value)}
                  style={{ padding:'4px 7px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:12, background:'#fff', cursor:'pointer', minWidth:80 }}>
                  {['All',...cities].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', fontWeight:500 }}>
                Agent
                <select value={fAgent} onChange={e => setFAgent(e.target.value)}
                  style={{ padding:'4px 7px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:12, background:'#fff', cursor:'pointer', minWidth:120 }}>
                  {['All',...(allowedAgents ? agents.filter(a=>allowedAgents.has(a)) : agents)].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </>
          )}

          <div style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8' }}>
            {fYear && fMonth ? `${shortM(fMonth)} ${fYear}` : 'Select year & month'}
          </div>
        </div>

        {(!fYear || !fMonth) && (
          <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10, padding:'16px 20px', color:'#9a3412', fontSize:13, marginBottom:16 }}>
            👆 Please select a <strong>Year</strong> and <strong>Month</strong> to view commissions.
          </div>
        )}

        {fYear && fMonth && (<>

        {/* SUMMARY CARDS — not shown to verification manager */}
        {showTopCards && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:16 }}>
            {showUpsellTotalCard && <div style={card}><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Total Upseller Commissions</div><div style={{ fontSize:22, fontWeight:800, color:C.blue }}>{fmtMAD(totalUpsellComm)}</div></div>}
            {showVerTotalCard    && <div style={card}><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Total Verification Commissions</div><div style={{ fontSize:22, fontWeight:800, color:C.teal }}>{fmtMAD(totalVerComm)}</div></div>}
            {isAdmin             && <div style={card}><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Total Commissions</div><div style={{ fontSize:22, fontWeight:800, color:C.purple }}>{fmtMAD(totalUpsellComm+totalVerComm)}</div></div>}
            {showUpsellTotalCard && <div style={card}><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Agents Paid</div><div style={{ fontSize:22, fontWeight:800, color:C.green }}>{upsellers.length}</div></div>}
            <div style={card}><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Verification Agents</div><div style={{ fontSize:22, fontWeight:800, color:C.amber }}>{verAgents.length}</div></div>
          </div>
        )}

        {/* UPSELLERS TABLE */}
        {showUpsellersTable && (
          <div style={{ ...card, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>💼 Upsellers Commission</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                  {shortM(fMonth)} {fYear} · &lt;150%: 3% · 150–200%: 4% · ≥200%: 5%
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:C.blue }}>{fmtMAD(totalUpsellComm)}</div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>{['#','Year','Month','Agent','Total Revenue','Target','% Reached','Commission (MAD)',''].map(h=><th key={h} style={thSt}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {upsellers.length === 0 && <tr><td colSpan={9} style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:13 }}>No data for this period</td></tr>}
                  {upsellers.map((a,i) => {
                    const pctColor = a.pct===null?C.slate:a.pct>=200?C.purple:a.pct>=150?C.green:a.pct>=100?C.teal:a.pct>=70?C.amber:C.red;
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
                        <td style={{ ...tdSt(i), color:'#64748b' }}>{a.target>0?fmtGBP(a.target):'—'}</td>
                        <td style={{ ...tdSt(i), fontWeight:700, color:pctColor }}>{fmtPct(a.pct)}</td>
                        <td style={{ ...tdSt(i), fontWeight:800, color:C.purple, fontSize:14 }}>{fmtMAD(Math.round(a.commission))}</td>
                        <td style={{ ...tdSt(i), minWidth:90 }}>
                          {a.pct!==null&&<div style={{ height:6, background:'#e2e8f0', borderRadius:3 }}><div style={{ height:'100%', width:Math.min(a.pct,100)+'%', background:pctColor, borderRadius:3 }}/></div>}
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
                      <td/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* VERIFICATION TABLE */}
        {showVerTable && (
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>{verTableTitle}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                  {shortM(fMonth)} {fYear} · Paid/SFDP/Scheduled=+1 · Fail=0 · CB/Refund=−1
                  {showVerCommissionCol && ' · Commission = (120 × Repitched) + (60 × Overturned) + Top Bonus'}
                </div>
              </div>
              {showVerCommissionCol && <div style={{ fontSize:13, fontWeight:700, color:C.teal }}>{fmtMAD(totalVerComm)}</div>}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['#','Year','Month','Verification Agent','Overturned Payments','Repitched Leads',
                      ...(showVerBonusCol ? ['Top Performer Bonus'] : []),
                      ...(showVerCommissionCol ? ['Commission (MAD)'] : []),
                    ].map(h => <th key={h} style={thSt}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {verAgents.length === 0 && <tr><td colSpan={8} style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:13 }}>No verification data for this period</td></tr>}
                  {verAgents.map((a,i) => (
                    <tr key={a.name}>
                      <td style={tdSt(i)}><span style={{ color:'#94a3b8', fontWeight:600 }}>{i+1}</span></td>
                      <td style={tdSt(i)}>{fYear}</td>
                      <td style={tdSt(i)}>{shortM(fMonth)}</td>
                      <td style={tdSt(i)}>
                        <span style={{ fontWeight:600, color:'#1e293b' }}>{a.name}</span>
                        {showVerBonusCol && a.topBonus > 0 && <span style={{ marginLeft:6, fontSize:10, background:'#FEF3C7', color:C.amber, padding:'2px 7px', borderRadius:4, fontWeight:700 }}>🏆 Top</span>}
                      </td>
                      <td style={{ ...tdSt(i), fontWeight:700, color:a.overturned>=0?C.green:C.red, textAlign:'center' }}>{a.overturned>=0?'+':''}{a.overturned}</td>
                      <td style={{ ...tdSt(i), fontWeight:700, color:a.repitched>=0?C.blue:C.red, textAlign:'center' }}>{a.repitched>=0?'+':''}{a.repitched}</td>
                      {showVerBonusCol && <td style={{ ...tdSt(i), textAlign:'center', fontWeight:700, color:a.topBonus>0?C.amber:'#94a3b8' }}>{a.topBonus>0?fmtMAD(a.topBonus):'—'}</td>}
                      {showVerCommissionCol && <td style={{ ...tdSt(i), fontWeight:800, color:C.teal, fontSize:14 }}>{fmtMAD(Math.round(a.commission))}</td>}
                    </tr>
                  ))}
                </tbody>
                {showVerCommissionCol && verAgents.length > 0 && (
                  <tfoot>
                    <tr style={{ background:'#F1F5F9' }}>
                      <td colSpan={showVerBonusCol?6:5} style={{ padding:'9px 12px', fontWeight:700, fontSize:12, color:'#0f172a' }}>TOTAL</td>
                      <td style={{ padding:'9px 12px', fontWeight:800, color:C.teal, fontSize:14 }}>{fmtMAD(Math.round(totalVerComm))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        </>)}
        </>)}
      </div>
    </div>
  );
}
