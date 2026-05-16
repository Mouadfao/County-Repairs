'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const SKY   = 'linear-gradient(rgb(40,14,1) 0%, rgb(24,38,68) 15%, rgb(90,118,159) 30%, rgb(135,161,196) 43%, rgb(193,211,230) 58%, rgb(254,249,225) 79%, rgb(247,243,240) 100%)';
const SERIF = "'IBM Plex Serif', Georgia, serif";
const SANS  = "'Inter', system-ui, sans-serif";

export default function Home() {
  const [view,     setView]     = useState('home');
  const [userRole, setUserRole] = useState('user');
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{
      if(d.role){ setUserRole(d.role); setUsername(d.username||''); }
    }).catch(()=>{});
  }, []);

  const isSuperAdmin = userRole==='super_admin';
  const isVerificationManager = userRole==='verification_manager';
  const showStats = !isVerificationManager;
  const showUsers = isSuperAdmin;

  async function logout() {
    await fetch('/api/auth/logout', { method:'POST' });
    window.location.href = '/login';
  }

  if (view==='menu') {
    const cards = [
      showStats && { href:'/stats', icon:'📊', title:'Sales Stats', desc:'Revenue analytics, agent performance, targets & forecasting', accent:'#1d3557' },
      { href:'/commissions', icon:'💰', title:'Commissions', desc:'Agent payouts, verification scores & earnings breakdown', accent:'#e46c44' },
      showUsers && { href:'/users', icon:'👥', title:'Users', desc:'Manage portal access, roles & account permissions', accent:'#457b9d' },
    ].filter(Boolean);

    return (
      <div style={{ minHeight:'100vh', background:SKY, fontFamily:SANS, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px' }}>
        <div style={{ position:'fixed', top:0, left:0, right:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', background:'rgba(247,243,240,.7)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(153,161,175,.15)', zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:SERIF, fontSize:18, fontWeight:400, color:'#0c1018', letterSpacing:'-0.36px' }}>County Repairs</span>
            <span style={{ fontSize:11, color:'#9e9fa3', marginLeft:4 }}>/ Portal</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {username && <span style={{ fontSize:12, color:'#6d7074' }}>{username}</span>}
            <button onClick={()=>setView('home')} style={{ fontSize:12, color:'#6d7074', background:'none', border:'none', cursor:'pointer' }}>← Back</button>
            <button onClick={logout} style={{ fontSize:12, color:'#0c1018', background:'rgba(153,161,175,.08)', border:'1px solid rgba(153,161,175,.2)', borderRadius:90, padding:'6px 16px', cursor:'pointer' }}>Sign Out</button>
          </div>
        </div>
        <div style={{ textAlign:'center', marginBottom:48, marginTop:80 }}>
          <div style={{ fontFamily:SERIF, fontSize:48, fontWeight:400, color:'#0c1018', letterSpacing:'-0.96px', lineHeight:1.05, marginBottom:10 }}>Select a Module</div>
          <div style={{ fontSize:13, color:'#6d7074', letterSpacing:'-0.13px' }}>County Repairs Internal Operations</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${cards.length},1fr)`, gap:20, maxWidth:920, width:'100%' }}>
          {cards.map(({ href, icon, title, desc, accent })=>(
            <Link key={href} href={href} style={{ textDecoration:'none' }}>
              <div style={{ background:'#fff', borderRadius:16, padding:'36px 28px', cursor:'pointer', transition:'all .25s', border:'1px solid rgba(153,161,175,.15)', boxShadow:'0 2px 12px rgba(12,16,24,.06)' }}
                onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow=`0 16px 48px rgba(12,16,24,.14)`; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 12px rgba(12,16,24,.06)'; }}>
                <div style={{ fontSize:36, marginBottom:20 }}>{icon}</div>
                <div style={{ fontFamily:SERIF, fontSize:22, fontWeight:400, color:'#0c1018', letterSpacing:'-0.44px', marginBottom:8 }}>{title}</div>
                <div style={{ fontSize:13, color:'#9e9fa3', lineHeight:1.6, marginBottom:28 }}>{desc}</div>
                <span style={{ fontSize:13, color:accent, fontWeight:500 }}>Open →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:SKY, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:SANS }}>
      <div style={{ position:'fixed', top:20, right:28 }}>
        <button onClick={logout} style={{ fontSize:12, color:'#6d7074', background:'rgba(255,255,255,.5)', border:'1px solid rgba(153,161,175,.2)', borderRadius:90, padding:'6px 16px', cursor:'pointer', backdropFilter:'blur(8px)' }}>Sign Out</button>
      </div>
      <div style={{ textAlign:'center' }}>
        <div onClick={()=>setView('menu')}
          style={{ background:'rgba(255,255,255,.85)', backdropFilter:'blur(20px)', borderRadius:24, padding:'64px 80px', cursor:'pointer', display:'inline-block', border:'1px solid rgba(153,161,175,.2)', boxShadow:'0 8px 48px rgba(12,16,24,.1)', transition:'all .3s' }}
          onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow='0 24px 64px rgba(12,16,24,.18)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 8px 48px rgba(12,16,24,.1)'; }}>
          <div style={{ fontFamily:SERIF, fontSize:56, fontWeight:400, color:'#0c1018', letterSpacing:'-1.12px', lineHeight:1.05, marginBottom:10 }}>County Repairs</div>
          <div style={{ fontSize:12, color:'#9e9fa3', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:36 }}>Internal Operations Portal</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#0c1018', color:'#fff', fontSize:14, fontWeight:500, padding:'14px 32px', borderRadius:90 }}>Enter Portal →</div>
        </div>
        <div style={{ marginTop:24, fontSize:11, color:'rgba(12,16,24,.3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Click to access your workspace</div>
      </div>
    </div>
  );
}
