'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

// ── helpers ────────────────────────────────────────────────────────────────
const MONTH_ORDER = ['01.January','02.February','03.March','04.April','05.May','06.June',
  '07.July','08.August','09.September','10.October','11.November','12.December'];
const shortM  = m => m.replace(/^\d+\./,'').slice(0,3);
const sortM   = arr => [...new Set(arr)].sort((a,b) => MONTH_ORDER.indexOf(a)-MONTH_ORDER.indexOf(b));
const fmt     = n => { if(n===null||n===undefined) return '—'; const s=n<0?'-':''; return s+'£'+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}); };

const countsRev = r => ['Paid','SFDP','Charge Back','Admin Refund','Manual Refund'].includes(r.status);
const isPaid    = r => r.status === 'Paid';
const isSFDP    = r => r.status === 'SFDP';
const isNeg     = r => ['Charge Back','Admin Refund','Manual Refund'].includes(r.status);
const isHidden  = name => /office|manager|claim\s*fee/i.test(name);

const SERIF = "'IBM Plex Serif', Georgia, serif";
const SANS  = "'Inter', system-ui, sans-serif";
const BG    = '#f4f0eb';
const C = { blue:'#1d3557', green:'#2d6a4f', red:'#c1121f', orange:'#e46c44', purple:'#5c4b8a', teal:'#457b9d', amber:'#e76f51', slate:'#6d7074' };
const card = { background:'#fff', borderRadius:16, padding:'20px 24px', boxShadow:'0 1px 4px rgba(12,16,24,.06), 0 4px 16px rgba(12,16,24,.04)', border:'1px solid rgba(153,161,175,.12)', fontFamily:SANS };
const bOpts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } };

export default function StatsPage() {
  const [raw,     setRaw]     = useState({ sales:[], targets:[], debugInfo:{} });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [updated, setUpdated] = useState('');
  const [userRole, setUserRole] = useState('admin');

  const [fYear,   setFYear]   = useState('All');
  const [fMonth,  setFMonth]  = useState('All');
  const [fCity,   setFCity]   = useState('All');
  const [fAgent,  setFAgent]  = useState('All');

  // Get role from server
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.role) setUserRole(d.role); })
      .catch(() => {});
  }, []);

  const isUpsellersManager    = userRole === 'upsellers_manager';
  const isVerificationManager = userRole === 'verification_manager';

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

  const { sales, targets } = raw;

  // ── filter options ─────────────────────────────────────────────────────
  const years  = useMemo(()=>[...new Set(sales.map(r=>r.year).filter(Boolean))].sort().reverse(),[sales]);
  const months = useMemo(()=>sortM(sales.filter(r=>fYear==='All'||r.year===fYear).map(r=>r.month).filter(Boolean)),[sales,fYear]);
  const cities = useMemo(()=>[...new Set(sales.map(r=>r.city||r.office).filter(Boolean))].sort(),[sales]);
  const agents = useMemo(()=>[...new Set(sales.map(r=>r.agent).filter(Boolean))].sort(),[sales]);

  // ── filtered targets ───────────────────────────────────────────────────
  const filteredTargets = useMemo(()=>
    targets.filter(t=>(!fYear||!t.year||t.year===fYear)&&(!fMonth||t.month===fMonth)),
  [targets,fYear,fMonth]);

  // ── Upsellers Manager: only agents whose team contains "Upsellers" ─────
  const allowedAgents = useMemo(()=>{
    if (!isUpsellersManager) return null; // null = no restriction
    const names = new Set();
    filteredTargets
      .filter(t => t.team && t.team.toLowerCase().includes('upsellers'))
      .forEach(t => names.add(t.agent));
    return names;
  }, [isUpsellersManager, filteredTargets]);

  // ── filtered sales ─────────────────────────────────────────────────────
  const filtered = useMemo(()=>sales.filter(r=>
    (fYear ==='All'||r.year ===fYear)  &&
    (fMonth==='All'||r.month===fMonth) &&
    (fCity ==='All'||r.city ===fCity||r.office===fCity) &&
    (fAgent==='All'||r.agent===fAgent) &&
    (!allowedAgents || allowedAgents.has(r.agent))
  ),[sales,fYear,fMonth,fCity,fAgent,allowedAgents]);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const paidRev  = filtered.filter(isPaid).reduce((s,r)=>s+r.premium,0);
  const sfdpRev  = filtered.filter(isSFDP).reduce((s,r)=>s+r.premium,0);
  const negRev   = filtered.filter(isNeg).reduce((s,r)=>s+r.premium,0);
  const netRev   = paidRev + sfdpRev + negRev;
  const paidCnt  = filtered.filter(isPaid).length;
  const sfdpCnt  = filtered.filter(isSFDP).length;
  const negCnt   = filtered.filter(isNeg).length;
  const avgDeal  = paidCnt>0 ? Math.round(paidRev/paidCnt) : 0;
  const cbRate   = paidCnt>0 ? (negCnt/paidCnt*100).toFixed(1) : '0';

  const totalTarget = filteredTargets
    .filter(t => !allowedAgents || allowedAgents.has(t.agent))
    .reduce((s,t)=>s+t.target,0);
  const targetPct = totalTarget>0 ? Math.round(netRev/totalTarget*100) : null;

  // ── monthly chart data ─────────────────────────────────────────────────
  const chartMonths = months.length>0 ? months : MONTH_ORDER;
  const monthlyData = chartMonths.map(m=>{
    const recs = sales.filter(r=>
      r.month===m &&
      (fYear==='All'||r.year===fYear) &&
      (fAgent==='All'||r.agent===fAgent) &&
      (fCity==='All'||r.city===fCity||r.office===fCity) &&
      (!allowedAgents||allowedAgents.has(r.agent))
    );
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
    const cm = sales.filter(r=>
      r.month===currentMonth &&
      (fYear==='All'||r.year===fYear) &&
      (!allowedAgents||allowedAgents.has(r.agent))
    );
    const dates = cm.map(r=>parseFloat(r.date)).filter(n=>!isNaN(n)&&n>40000).sort((a,b)=>a-b);
    if(dates.length>3) {
      const span=dates[dates.length-1]-dates[0]+1;
      const cmNet=cm.filter(countsRev).reduce((s,r)=>s+r.premium,0);
      if(span>0) {
        prediction=Math.round((cmNet/span)*30);
        const cmTgt=targets.filter(t=>
          t.month===currentMonth &&
          (!fYear||!t.year||t.year===fYear) &&
          (!allowedAgents||allowedAgents.has(t.agent))
        ).reduce((s,t)=>s+t.target,0);
        if(cmTgt>0) predPct=Math.round(prediction/cmTgt*100);
      }
    }
  }

  // ── agent performance ──────────────────────────────────────────────────
  const agentMap={};
  filtered.filter(r=>countsRev(r)&&r.agent&&!isHidden(r.agent)).forEach(r=>{
    if(!agentMap[r.agent]) agentMap[r.agent]={agent:r.agent,office:r.office,city:r.city,paid:0,sfdp:0,neg:0,net:0};
    agentMap[r.agent].net+=r.premium;
    if(isPaid(r)) agentMap[r.agent].paid++;
    if(isSFDP(r)) agentMap[r.agent].sfdp++;
    if(isNeg(r))  agentMap[r.agent].neg++;
  });

  const agentPerf=Object.values(agentMap).map(a=>{
    const tgt=filteredTargets.filter(t=>t.agent===a.agent).reduce((s,t)=>s+t.target,0);
    return {...a,target:tgt,pct:tgt>0?Math.round(a.net/tgt*100):null};
  }).sort((a,b)=>b.net-a.net);

  // ── office breakdown ───────────────────────────────────────────────────
  const offMap={};
  filtered.filter(countsRev).forEach(r=>{ const k=(r.city||r.office||'?').trim(); offMap[k]=(offMap[k]||0)+r.premium; });
  const offData=Object.entries(offMap).filter(([k])=>k&&k.length>1).sort((a,b)=>b[1]-a[1]);

  // ── portal breakdown (admin only) ──────────────────────────────────────
  const portMap={};
  filtered.filter(isPaid).forEach(r=>{ const p=r.portal||'Other'; portMap[p]=(portMap[p]||0)+r.premium; });
  const portData=Object.entries(portMap).filter(([k])=>k&&k.length>1).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const showPortals = !isUpsellersManager;

  return (
    <div style={{minHeight:'100vh',background:BG,fontFamily:SANS}}>

      {/* HEADER */}
      <div style={{background:'rgba(247,243,240,.92)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(153,161,175,.15)',padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,position:'sticky',top:0,zIndex:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Link href="/" style={{color:'#9e9fa3',textDecoration:'none',fontSize:12,fontFamily:SANS}}>← Portal</Link>
          <span style={{color:'rgba(153,161,175,.4)',fontSize:12}}>/</span>
          <span style={{fontFamily:SERIF,fontSize:18,fontWeight:400,color:'#0c1018',letterSpacing:'-0.36px'}}>Sales Stats</span>
          {updated && <span style={{fontSize:11,color:'#9e9fa3',marginLeft:4}}>· {updated}</span>}
        </div>
        <button onClick={load} style={{padding:'7px 20px',background:'#0c1018',color:'#fff',border:'none',borderRadius:90,cursor:'pointer',fontSize:12,fontFamily:SANS,fontWeight:500,letterSpacing:'-0.12px'}}>⟳ Refresh</button>
      </div>

      <div style={{padding:'16px 24px'}}>
        {loading&&<div style={{textAlign:'center',padding:'80px',color:'#9e9fa3',fontFamily:SANS}}><div style={{fontSize:32,marginBottom:12,opacity:.4}}>◌</div><p style={{fontSize:13,letterSpacing:'-0.13px'}}>Loading data…</p></div>}
        {error&&<div style={{background:'#fef2f2',border:'1px solid rgba(193,18,31,.15)',borderRadius:12,padding:14,color:C.red,fontSize:13,fontFamily:SANS}}><b>Error:</b> {error}</div>}

        {!loading&&!error&&(<>

        {/* FILTERS */}
        <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center',background:'#fff',padding:'12px 16px',borderRadius:12,boxShadow:'0 1px 4px rgba(12,16,24,.06)',border:'1px solid rgba(153,161,175,.12)',fontFamily:SANS}}>
          {[
            {label:'Year', val:fYear, set:setFYear, opts:['All',...years]},
            {label:'Month',val:fMonth,set:setFMonth,opts:['All',...months],display:['All',...months.map(shortM)]},
            {label:'City', val:fCity, set:setFCity, opts:['All',...cities]},
            {label:'Agent',val:fAgent,set:setFAgent,opts:['All',...(allowedAgents?agents.filter(a=>allowedAgents.has(a)):agents)]},
          ].map(({label,val,set,opts,display})=>(
            <label key={label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#9e9fa3',fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase'}}>
              {label}
              <select value={val} onChange={e=>set(e.target.value)} style={{padding:'5px 10px',borderRadius:50,border:'1px solid rgba(153,161,175,.2)',fontSize:12,background:'rgba(153,161,175,.05)',cursor:'pointer',minWidth:80,fontFamily:SANS,color:'#0c1018',outline:'none'}}>
                {opts.map((o,i)=><option key={o} value={o}>{display?display[i]:o}</option>)}
              </select>
            </label>
          ))}
          <div style={{marginLeft:'auto',fontSize:11,color:'#94a3b8'}}>{filtered.filter(countsRev).length.toLocaleString()} revenue records</div>
        </div>

        {/* KPI CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}>
          {[
            {label:'Net Revenue',   val:fmt(netRev),    color:netRev>=0?C.green:C.red,   sub:`Paid ${fmt(paidRev)} · SFDP ${fmt(sfdpRev)}`},
            {label:'Chargebacks',   val:fmt(negRev),    color:C.red,                      sub:`${negCnt} transactions`},
            {label:'Chargeback Rate',val:cbRate+'%',    color:parseFloat(cbRate)>15?C.red:parseFloat(cbRate)>8?C.amber:C.green, sub:`${negCnt} CB vs ${paidCnt} paid`},
            {label:'Avg Deal',      val:fmt(avgDeal),   color:C.purple,                   sub:'per paid sale'},
            {label:'Total Target',  val:fmt(totalTarget),color:C.slate,                   sub:targetPct!==null?targetPct+'% reached':'No target set'},
            {label:'vs Target',     val:targetPct!==null?targetPct+'%':'—', color:targetPct>=100?C.green:targetPct>=70?C.amber:C.red, sub:fmt(netRev)+' net'},
          ].map(({label,val,color,sub})=>(
            <div key={label} style={card}>
              <div style={{fontSize:10,color:'#9e9fa3',fontWeight:500,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6,fontFamily:SANS}}>{label}</div>
              <div style={{fontSize:24,fontWeight:600,color,lineHeight:1.1,fontFamily:SERIF,letterSpacing:'-0.48px'}}>{val}</div>
              <div style={{fontSize:11,color:'#9e9fa3',marginTop:5,letterSpacing:'-0.11px'}}>{sub}</div>
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
            <div style={{fontFamily:SERIF,fontSize:17,fontWeight:400,color:'#0c1018',letterSpacing:'-0.34px',marginBottom:10}}>Monthly Revenue Breakdown</div>
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
            <div style={{fontFamily:SERIF,fontSize:17,fontWeight:400,color:'#0c1018',letterSpacing:'-0.34px',marginBottom:8}}>Deal Mix</div>
            <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
              {[['Paid',paidCnt,C.green],['SFDP',sfdpCnt,C.teal],['CB/Refunds',negCnt,C.red]].map(([l,v,c])=>(
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
          <div style={{fontFamily:SERIF,fontSize:17,fontWeight:400,color:'#0c1018',letterSpacing:'-0.34px',marginBottom:3}}>Agent Performance vs Target</div>
          <div style={{fontSize:11,color:'#9e9fa3',letterSpacing:'-0.11px',marginBottom:10}}>Net = Paid + SFDP + CB/Refunds. Target from Target_List sheet.</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#F8FAFC',borderBottom:'2px solid #e2e8f0'}}>
                  {['#','Agent','City','Paid','SFDP','CB','Net Revenue','Target','% Reached','Progress'].map(h=>(
                    <th key={h} style={{padding:'9px 12px',textAlign:'left',color:'#9e9fa3',fontWeight:500,whiteSpace:'nowrap',fontSize:10,textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid rgba(153,161,175,.15)',background:'rgba(153,161,175,.04)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentPerf.map((a,i)=>{
                  const p=a.pct;
                  const bc=p===null?C.slate:p>=100?C.green:p>=70?C.amber:C.red;
                  return (
                    <tr key={a.agent} style={{background:'#fff',borderBottom:'1px solid rgba(153,161,175,.1)'}}>
                      <td style={{padding:'9px 12px',color:'#9e9fa3',fontWeight:400,fontSize:12}}>{i+1}</td>
                      <td style={{padding:'9px 12px',fontWeight:500,color:'#0c1018',fontSize:13}}>{a.agent}</td>
                      <td style={{padding:'9px 12px',color:'#9e9fa3',fontSize:12}}>{a.city||a.office||'—'}</td>
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
        <div style={{display:'grid',gridTemplateColumns: showPortals ? '1fr 1fr' : '1fr',gap:12,marginBottom:14}}>
          <div style={card}>
            <div style={{fontFamily:SERIF,fontSize:17,fontWeight:400,color:'#0c1018',letterSpacing:'-0.34px',marginBottom:12}}>Net Revenue by City</div>
            <div style={{height:220}}>
              <Bar data={{labels:offData.map(([k])=>k.length>20?k.slice(0,20)+'…':k),datasets:[{
                data:offData.map(([,v])=>v),
                backgroundColor:offData.map(([,v])=>v>=0?C.blue+'99':C.red+'99'),
                borderColor:offData.map(([,v])=>v>=0?C.blue:C.red),
                borderWidth:1,borderRadius:4,
              }]}} options={{...bOpts,indexAxis:'y',scales:{x:{ticks:{callback:v=>fmt(v),font:{size:10}}},y:{ticks:{font:{size:11}},grid:{display:false}}}}} />
            </div>
          </div>

          {showPortals && (
            <div style={card}>
              <div style={{fontFamily:SERIF,fontSize:17,fontWeight:400,color:'#0c1018',letterSpacing:'-0.34px',marginBottom:12}}>Top Payment Portals</div>
              <div style={{height:220}}>
                <Bar data={{labels:portData.map(([k])=>k),datasets:[{data:portData.map(([,v])=>v),backgroundColor:C.teal+'99',borderColor:C.teal,borderWidth:1,borderRadius:4}]}} options={{...bOpts,scales:{x:{grid:{display:false},ticks:{font:{size:10},maxRotation:30}},y:{ticks:{callback:v=>fmt(v),font:{size:10}}}}}} />
              </div>
            </div>
          )}
        </div>

        {/* LEADERBOARD */}
        <div style={card}>
          <div style={{fontFamily:SERIF,fontSize:17,fontWeight:400,color:'#0c1018',letterSpacing:'-0.34px',marginBottom:4}}>🏆 Top 10 Leaderboard</div>
          <div style={{fontSize:11,color:'#9e9fa3',letterSpacing:'-0.11px',marginBottom:12}}>Ranked by net revenue. Colour = target % (green ≥100%, amber ≥70%, red below).</div>
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
