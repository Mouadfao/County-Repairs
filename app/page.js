'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [view, setView] = useState('home'); // 'home' | 'menu' | 'commissions'

  if (view === 'commissions') {
    return (
      <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
        <button onClick={()=>setView('menu')} style={{ position:'absolute', top:24, left:24, background:'transparent', border:'1px solid #334155', color:'#94a3b8', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
          ← Back
        </button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:64, marginBottom:20 }}>🚧</div>
          <div style={{ fontSize:32, fontWeight:800, color:'#fff', marginBottom:10 }}>Coming Soon</div>
          <div style={{ fontSize:16, color:'#64748b', marginBottom:6 }}>County Repairs Commissions</div>
          <div style={{ fontSize:13, color:'#475569' }}>This module is under development</div>
        </div>
      </div>
    );
  }

  if (view === 'menu') {
    return (
      <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif', padding:24 }}>
        <button onClick={()=>setView('home')} style={{ position:'absolute', top:24, left:24, background:'transparent', border:'1px solid #334155', color:'#94a3b8', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
          ← Back
        </button>

        {/* Logo row */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:48 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🏢</div>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>County Repairs</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>Select a module</div>
          </div>
        </div>

        {/* Two cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, maxWidth:600, width:'100%' }}>

          {/* Stats card */}
          <Link href="/stats" style={{ textDecoration:'none' }}>
            <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:16, padding:'32px 24px', cursor:'pointer', textAlign:'center', transition:'all .2s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='#2563eb'; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(37,99,235,.25)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='#334155'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
              <div style={{ fontSize:44, marginBottom:16 }}>📊</div>
              <div style={{ fontSize:17, fontWeight:700, color:'#fff', marginBottom:6 }}>County Repairs Stats</div>
              <div style={{ fontSize:12, color:'#64748b', lineHeight:1.6 }}>Sales performance, agent targets, revenue analytics & forecasting</div>
              <div style={{ marginTop:18, display:'inline-block', background:'#2563eb', color:'#fff', fontSize:12, fontWeight:600, padding:'7px 18px', borderRadius:8 }}>Open Dashboard →</div>
            </div>
          </Link>

          {/* Commissions card */}
          <div onClick={()=>window.location.href='/commissions'}
            style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:16, padding:'32px 24px', cursor:'pointer', textAlign:'center', transition:'all .2s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='#7c3aed'; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(124,58,237,.2)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='#334155'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
            <div style={{ fontSize:44, marginBottom:16 }}>💰</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#fff', marginBottom:6 }}>County Repairs Commissions</div>
            <div style={{ fontSize:12, color:'#64748b', lineHeight:1.6 }}>Agent commission calculations, payouts & earnings breakdown</div>
            <div style={{ marginTop:18, display:'inline-block', background:'#7c3aed', color:'#fff', fontSize:12, fontWeight:600, padding:'7px 18px', borderRadius:8 }}>Coming Soon →</div>
          </div>

        </div>
      </div>
    );
  }

  // ── HOME: Single County Repairs card ──────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ textAlign:'center' }}>

        {/* Animated card */}
        <div onClick={()=>setView('menu')}
          style={{ background:'#1e293b', border:'1px solid #1e40af', borderRadius:24, padding:'56px 72px', cursor:'pointer', display:'inline-block', transition:'all .25s' }}
          onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.03)'; e.currentTarget.style.boxShadow='0 24px 64px rgba(37,99,235,.3)'; e.currentTarget.style.borderColor='#2563eb'; }}
          onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='#1e40af'; }}>

          <div style={{ fontSize:64, marginBottom:20 }}>🏢</div>
          <div style={{ fontSize:36, fontWeight:900, color:'#fff', letterSpacing:'-1px', marginBottom:8 }}>County Repairs</div>
          <div style={{ fontSize:14, color:'#64748b', marginBottom:28 }}>Internal Operations Portal</div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#2563eb', color:'#fff', fontSize:14, fontWeight:600, padding:'12px 28px', borderRadius:10 }}>
            <span>Enter Portal</span>
            <span>→</span>
          </div>
        </div>

        <div style={{ marginTop:24, fontSize:12, color:'#334155' }}>Click to access your dashboard</div>
      </div>
    </div>
  );
}
