'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

// ── helpers ────────────────────────────────────────────────────────────────
// Agents to hide from tables/leaderboard (still counted in revenue KPIs)
const isHiddenAgent = name => /office|manager|claim\s*fee/i.test(name);

const MONTH_ORDER = ['01.January','02.February','03.March','04.April','05.May','06.June',
  '07.July','08.August','09.September','10.October','11.November','12.December'];
const shortM  = m => m.replace(/^\d+\./,'').slice(0,3);
const sortM   = arr => [...new Set(arr)].sort((a,b)=>MONTH_ORDER.indexOf(a)-MONTH_ORDER.indexOf(b));
const fmt     = n => { if(n===null||n===undefined) return '—'; const s=n<0?'-':''; return s+'£'+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}); };

// Revenue = Paid + SFDP + CB/Refunds (CB already negative → just add)
const countsRev = r => ['Paid','SFDP','Charge Back','Admin Refund','Manual Refund'].includes(r.status);
const isPaid    = r => r.status === 'Paid';
const isSFDP    = r => r.status === 'SFDP';
const isNeg     = r => ['Charge Back','Admin Refund','Manual Refund'].includes(r.status);

const C = { blue:'#2563eb', green:'#16a34a', red:'#dc2626', orange:'#f97316', purple:'#7c3aed', teal:'#0891b2', amber:'#d97706', slate:'#64748b' };
const card = { background:'#fff', borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 3px rgba(0,0,0,.07)' };
const bOpts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } };

export default function StatsPage() {
  const [raw,     setRaw]     = useState({ sales:[], targets:[], debugInfo:{} });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [updated, setUpdated] = useState('');
  const [debug,   setDebug]   = useState(false);

  const [fYear,   setFYear]   = useState('All');
  const [fMonth,  setFMonth]  = useState('All');
  const [fCity,   setFCity]   = useState('All');
  const [fAgent,  setFAgent]  = useState('All');

  async function load() {
    setLoading(true); setError('');
    try {
      const j = await fetch('/api/sheets').then(r=>r.json());
      if(j.error) throw new Error(j.error);
      setRaw(j);
      setUpdated(new Date().toLocaleTimeString());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  const { sales, targets, debugInfo } = raw;

  // ── filter options ─────────────────────────────────────────────────────
  const years  = useMemo(()=>[...new Set(sales.map(r=>r.year).filter(Boolean))].sort().reverse(),[sales]);
  const months = useMemo(()=>sortM(sales.filter(r=>fYear==='All'||r.year===fYear).map(r=>r.month).filter(Boolean)),[sales,fYear]);
  const cities = useMemo(()=>[...new Set(sales.map(r=>r.city||r.office).filter(Boolean))].sort(),[sales]);
  const agents = useMemo(()=>[...new Set(sales.map(r=>r.agent).filter(Boolean))].sort(),[sales]);

  const filtered = useMemo(()=>sales.filter(r=>
    (fYear ==='All'||r.year ===fYear)  &&
    (fMonth==='All'||r.month===fMonth) &&
    (fCity ==='All'||r.city ===fCity||r.office===fCity) &&
    (fAgent==='All'||r.agent===fAgent)
  ),[sales,fYear,fMonth,fCity,fAgent]);

  // ── KPIs ───────────────────────────────────────────────────────────────
  // Net = sum of all revenue-counting rows (Paid+SFDP positive, CB/refunds already negative)
  const netRev   = filtered.filter(countsRev).reduce((s,r)=>s+r.premium,0);
  const paidRev  = filtered.filter(isPaid).reduce((s,r)=>s+r.premium,0);
  const sfdpRev  = filtered.filter(isSFDP).reduce((s,r)=>s+r.premium,0);
  const negRev   = filtered.filter(isNeg).reduce((s,r)=>s+r.premium,0);
  const paidCnt  = filtered.filter(isPaid).length;
  const sfdpCnt  = filtered.filter(isSFDP).length;
  const negCnt   = filtered.filter(isNeg).length;
  const avgDeal  = paidCnt>0 ? Math.round(paidRev/paidCnt) : 0;

  // ── targets ────────────────────────────────────────────────────────────
  const filteredTargets = targets.filter(t=>
    (fYear ==='All'||t.year ===fYear) &&
    (fMonth==='All'||t.month===fMonth)
  );
  const totalTarget = filteredTargets.reduce((s,t)=>s+t.target,0);
  const targetPct   = totalTarget>0 ? Math.round(netRev/totalTarget*100) : null;

  // ── monthly chart data ─────────────────────────────────────────────────
  const chartMonths = months.length>0 ? months : MONTH_ORDER;
  const monthlyData = chartMonths.map(m=>{
    const recs = sales.filter(r=>r.month===m&&(fYear==='All'||r.year===fYear)&&(fAgent==='All'||r.agent===fAgent)&&(fCity==='All'||r.city===fCity||r.office===fCity));
    return {
      paid: recs.filter(isPaid).reduce((s,r)=>s+r.premium,0),
      sfdp: recs.filter(isSFDP).reduce((s,r)=>s+r.premium,0),
      neg:  recs.filter(isNeg).reduce((s,r)=>s+r.premium,0),
    };
  });

  // ── prediction ─────────────────────────────────────────────────────────
  const currentMonth = months[months.length-1];
  let prediction=null, predPct=null;
  if(currentMonth) {
    const cm = sales.filter(r=>r.month===currentMonth&&(fYear==='All'||r.year===fYear));
    const dates = cm.map(r=>parseFloat(r.date)).filter(n=>!isNaN(n)&&n>40000).sort((a,b)=>a-b);
    if(dates.length>3) {
      const span=dates[dates.length-1]-dates[0]+1;
      const cmNet=cm.filter(countsRev).reduce((s,r)=>s+r.premium,0);
      if(span>0) {
        prediction=Math.round((cmNet/span)*30);
        const cmTgt=targets.filter(t=>t.month===currentMonth&&(fYear==='All'||t.year===fYear)).reduce((s,t)=>s+t.target,0);
        if(cmTgt>0) predPct=Math.round(prediction/cmTgt*100);
      }
    }
  }

  // ── agent performance ──────────────────────────────────────────────────
  const agentMap={};
  filtered.filter(r=>countsRev(r)&&r.agent).forEach(r=>{
    if(!agentMap[r.agent]) agentMap[r.agent]={agent:r.agent,office:r.office,city:r.city,paid:0,sfdp:0,neg:0,net:0};
    agentMap[r.agent].net+=r.premium;
    if(isPaid(r)) agentMap[r.agent].paid++;
    if(isSFDP(r)) agentMap[r.agent].sfdp++;
    if(isNeg(r))  agentMap[r.agent].neg++;
  });

  const agentPerf=Object.values(agentMap).map(a=>{
    const tgt=filteredTargets.filter(t=>t.agent===a.agent).reduce((s,t)=>s+t.target,0);
    return {...a,target:tgt,pct:tgt>0?Math.round(a.net/tgt*100):null};
  }).filter(a => !isHiddenAgent(a.agent)).sort((a,b)=>b.net-a.net);

  // ── office breakdown ───────────────────────────────────────────────────
  const offMap={};
  filtered.filter(countsRev).forEach(r=>{ const k=(r.city||r.office||'?').trim(); offMap[k]=(offMap[k]||0)+r.premium; });
  const offData=Object.entries(offMap).filter(([k])=>k&&k.length>1).sort((a,b)=>b[1]-a[1]);

  // ── portal breakdown ───────────────────────────────────────────────────
  const portMap={};
  filtered.filter(isPaid).forEach(r=>{ const p=r.portal||'Other'; portMap[p]=(portMap[p]||0)+r.premium; });
  const portData=Object.entries(portMap).filter(([k])=>k&&k.length>1).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // ── status counts for doughnut ─────────────────────────────────────────
  const statusCount={Paid:paidCnt,SFDP:sfdpCnt,'CB/Refunds':negCnt};

  return (
    <div style={{minHeight:'100vh',background:'#F1F5F9',fontFamily:'system-ui,sans-serif'}}>

      {/* HEADER */}
      <div style={{background:'#0f172a',color:'#fff',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Link href="/" style={{color:'#64748b',textDecoration:'none',fontSize:12,marginRight:4,display:'flex',alignItems:'center',gap:4}}>
            <span>🏢</span><span>Portal</span><span style={{margin:'0 4px'}}>/</span>
          </Link>
          <div style={{width:30,height:30,borderRadius:7,background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>📊</div>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>County Repairs — Sales Stats</div>
            <div style={{fontSize:10,opacity:.5,marginTop:1}}>{updated?`Live · ${updated}`:'Loading...'}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setDebug(d=>!d)} style={{padding:'5px 11px',background:'transparent',border:'1px solid #334155',color:'#94a3b8',borderRadius:6,cursor:'pointer',fontSize:11}}>{debug?'Hide':'Debug'}</button>
          <button onClick={load} style={{padding:'5px 14px',background:C.blue,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>⟳ Refresh</button>
        </div>
      </div>

      {/* DEBUG */}
      {debug&&debugInfo&&(
        <div style={{background:'#1e293b',color:'#94a3b8',padding:'10px 24px',fontSize:11,fontFamily:'monospace'}}>
          <div><b style={{color:'#fff'}}>Data headers:</b> {(debugInfo.dataHeaders||[]).join(' | ')}</div>
          <div><b style={{color:'#fff'}}>Sample Paid row:</b> {JSON.stringify(debugInfo.samplePaid)}</div>
          <div><b style={{color:'#fff'}}>Totals:</b> {debugInfo.totalSales} valid sales · {debugInfo.totalTargets} targets</div>
        </div>
      )}

      <div style={{padding:'16px 24px'}}>
        {loading&&<div style={{textAlign:'center',padding:'80px',color:'#64748b'}}><div style={{fontSize:40}}>⏳</div><p>Loading data…</p></div>}
        {error&&<div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:14,color:C.red,fontSize:13}}><b>Error:</b> {error}</div>}

        {!loading&&!error&&(<>

        {/* FILTERS */}
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center',background:'#fff',padding:'10px 14px',borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          {[
            {label:'Year', val:fYear, set:setFYear, opts:['All',...years]},
            {label:'Month',val:fMonth,set:setFMonth,opts:['All',...months],display:['All',...months.map(shortM)]},
            {label:'City', val:fCity, set:setFCity, opts:['All',...cities]},
            {label:'Agent',val:fAgent,set:setFAgent,opts:['All',...agents]},
          ].map(({label,val,set,opts,display})=>(
            <label key={label} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#64748b',fontWeight:500}}>
              {label}
              <select value={val} onChange={e=>set(e.target.value)} style={{padding:'4px 7px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,background:'#fff',cursor:'pointer',minWidth:80}}>
                {opts.map((o,i)=><option key={o} value={o}>{display?display[i]:o}</option>)}
              </select>
            </label>
          ))}
          <div style={{marginLeft:'auto',fontSize:11,color:'#94a3b8'}}>{filtered.filter(countsRev).length.toLocaleString()} revenue records</div>
        </div>

        {/* KPI CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}>
          {[
            {label:'Net Revenue',    val:fmt(netRev),    color:netRev>=0?C.green:C.red,   sub:`Paid ${fmt(paidRev)} · SFDP ${fmt(sfdpRev)}`},
            {label:'Chargebacks',    val:fmt(negRev),    color:C.red,                      sub:`${negCnt} transactions`},
            {label:'Paid Deals',     val:paidCnt,        color:C.blue,                     sub:`Avg deal ${fmt(avgDeal)}`},
            {label:'SFDP Deals',     val:sfdpCnt,        color:C.teal,                     sub:fmt(sfdpRev)+' collected'},
            {label:'Total Target',   val:fmt(totalTarget),color:C.slate,                   sub:targetPct!==null?targetPct+'% reached':'No target set'},
            {label:'vs Target',      val:targetPct!==null?targetPct+'%':'—', color:targetPct>=100?C.green:targetPct>=70?C.amber:C.red, sub:fmt(netRev)+' net'},
          ].map(({label,val,color,sub})=>(
            <div key={label} style={card}>
              <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5}}>{label}</div>
              <div style={{fontSize:22,fontWeight:800,color,lineHeight:1.1}}>{val}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{sub}</div>
            </div>
          ))}
        </div>

        {/* PREDICTION */}
        {prediction!==null&&(
          <div style={{...card,marginBottom:14,borderLeft:`4px solid ${C.purple}`,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
            <div style={{fontSize:28}}>🔮</div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em'}}>End-of-month projection — {shortM(currentMonth)}</div>
              <div style={{fontSize:20,fontWeight:800,color:C.purple,marginTop:2}}>
                {fmt(prediction)}
                {predPct!==null&&<span style={{fontSize:13,marginLeft:10,color:predPct>=100?C.green:predPct>=70?C.amber:C.red}}>{predPct}% of month target</span>}
              </div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>Daily run-rate × 30 days based on current month data</div>
            </div>
          </div>
        )}

        {/* MONTHLY STACKED BAR + DOUGHNUT */}
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12,marginBottom:14}}>
          <div style={card}>
            <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:10}}>Monthly Revenue Breakdown</div>
            <div style={{display:'flex',gap:14,marginBottom:10}}>
              {[['Paid',C.green],['SFDP',C.teal],['CB/Refunds',C.red]].map(([l,c])=>(
                <span key={l} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#64748b'}}>
                  <span style={{width:8,height:8,borderRadius:2,background:c}}/>{l}
                </span>
              ))}
            </div>
            <div style={{height:230}}>
              <Bar data={{labels:chartMonths.map(shortM),datasets:[
                {label:'Paid',data:monthlyData.map(d=>d.paid),backgroundColor:C.green+'bb',borderRadius:3,stack:'a'},
                {label:'SFDP',data:monthlyData.map(d=>d.sfdp),backgroundColor:C.teal+'bb',borderRadius:3,stack:'a'},
                {label:'CB/Refunds',data:monthlyData.map(d=>d.neg),backgroundColor:C.red+'bb',borderRadius:3,stack:'a'},
              ]}} options={{...bOpts,scales:{x:{grid:{display:false},ticks:{font:{size:11}}},y:{ticks:{callback:v=>fmt(v),font:{size:10}}}}}} />
            </div>
          </div>

          <div style={card}>
            <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:8}}>Deal Mix</div>
            <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
              {[[`Paid`,paidCnt,C.green],[`SFDP`,sfdpCnt,C.teal],[`CB/Refunds`,negCnt,C.red]].map(([l,v,c])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:8,height:8,borderRadius:2,background:c,flexShrink:0}}/>
                  <span style={{fontSize:11,color:'#64748b',flex:1}}>{l}</span>
                  <span style={{fontSize:12,fontWeight:700,color:c}}>{v.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Doughnut data={{labels:['Paid','SFDP','CB/Refunds'],datasets:[{data:[paidCnt,sfdpCnt,negCnt],backgroundColor:[C.green+'cc',C.teal+'cc',C.red+'cc'],borderWidth:1}]}} options={{...bOpts,cutout:'65%'}} />
            </div>
          </div>
        </div>

        {/* AGENT TABLE */}
        <div style={{...card,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:3}}>Agent Performance vs Target</div>
          <div style={{fontSize:11,color:'#94a3b8',marginBottom:10}}>Net = Paid + SFDP + CB/Refunds (CB already negative). Target from Target_List sheet.</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#F8FAFC',borderBottom:'2px solid #e2e8f0'}}>
                  {['#','Agent','City','Paid','SFDP','CB','Net Revenue','Target','% Reached','Progress'].map(h=>(
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',color:'#64748b',fontWeight:700,whiteSpace:'nowrap',fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentPerf.map((a,i)=>{
                  const p=a.pct;
                  const bc=p===null?C.slate:p>=100?C.green:p>=70?C.amber:C.red;
                  return (
                    <tr key={a.agent} style={{background:i%2===0?'#fff':'#F8FAFC',borderBottom:'1px solid #f1f5f9'}}>
                      <td style={{padding:'7px 10px',color:'#94a3b8',fontWeight:600}}>{i+1}</td>
                      <td style={{padding:'7px 10px',fontWeight:600,color:'#1e293b'}}>{a.agent}</td>
                      <td style={{padding:'7px 10px',color:'#64748b',fontSize:11}}>{a.city||a.office||'—'}</td>
                      <td style={{padding:'7px 10px',color:C.green,fontWeight:600}}>{a.paid}</td>
                      <td style={{padding:'7px 10px',color:C.teal}}>{a.sfdp||0}</td>
                      <td style={{padding:'7px 10px',color:C.red}}>{a.neg||0}</td>
                      <td style={{padding:'7px 10px',fontWeight:700,color:a.net>=0?C.blue:C.red}}>{fmt(a.net)}</td>
                      <td style={{padding:'7px 10px',color:'#64748b'}}>{a.target>0?fmt(a.target):'—'}</td>
                      <td style={{padding:'7px 10px',fontWeight:700,color:bc}}>{p!==null?p+'%':'—'}</td>
                      <td style={{padding:'7px 10px',minWidth:80}}>
                        {p!==null&&<div style={{height:6,background:'#e2e8f0',borderRadius:3}}>
                          <div style={{height:'100%',width:Math.min(p,100)+'%',background:bc,borderRadius:3}}/>
                        </div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CITY + PORTALS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
          <div style={card}>
            <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:12}}>Net Revenue by City</div>
            <div style={{height:220}}>
              <Bar data={{labels:offData.map(([k])=>k.length>20?k.slice(0,20)+'…':k),datasets:[{
                data:offData.map(([,v])=>v),
                backgroundColor:offData.map(([,v])=>v>=0?C.blue+'99':C.red+'99'),
                borderColor:offData.map(([,v])=>v>=0?C.blue:C.red),
                borderWidth:1,borderRadius:4,
              }]}} options={{...bOpts,indexAxis:'y',scales:{x:{ticks:{callback:v=>fmt(v),font:{size:10}}},y:{ticks:{font:{size:11}},grid:{display:false}}}}} />
            </div>
          </div>
          <div style={card}>
            <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:12}}>Top Payment Portals</div>
            <div style={{height:220}}>
              <Bar data={{labels:portData.map(([k])=>k),datasets:[{data:portData.map(([,v])=>v),backgroundColor:C.teal+'99',borderColor:C.teal,borderWidth:1,borderRadius:4}]}} options={{...bOpts,scales:{x:{grid:{display:false},ticks:{font:{size:10},maxRotation:30}},y:{ticks:{callback:v=>fmt(v),font:{size:10}}}}}} />
            </div>
          </div>
        </div>

        {/* LEADERBOARD */}
        <div style={card}>
          <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:4}}>🏆 Top 10 Leaderboard</div>
          <div style={{fontSize:11,color:'#94a3b8',marginBottom:12}}>Ranked by net revenue. Colour = target % (green ≥100%, amber ≥70%, red below).</div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {agentPerf.slice(0,10).map((a,i)=>{
              const maxRev=Math.max(agentPerf[0]?.net||1,1);
              const barW=Math.max(3,Math.round(Math.max(0,a.net)/maxRev*100));
              const bc=a.pct===null?C.blue:a.pct>=100?C.green:a.pct>=70?C.amber:C.red;
              return (
                <div key={a.agent} style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:24,textAlign:'center',fontSize:14,flexShrink:0}}>{['🥇','🥈','🥉'][i]||<span style={{color:'#94a3b8',fontSize:12}}>{i+1}</span>}</div>
                  <div style={{width:160,fontSize:12,fontWeight:500,color:'#1e293b',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flexShrink:0}}>{a.agent}</div>
                  <div style={{flex:1,height:18,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:barW+'%',background:bc+'cc',borderRadius:4}}/>
                  </div>
                  <div style={{width:72,textAlign:'right',fontSize:12,fontWeight:700,color:bc,flexShrink:0}}>{fmt(a.net)}</div>
                  <div style={{width:42,textAlign:'right',fontSize:11,color:'#94a3b8',flexShrink:0}}>{a.pct!==null?a.pct+'%':''}</div>
                </div>
              );
            })}
          </div>
        </div>

        </>)}
      </div>
    </div>
  );
}
