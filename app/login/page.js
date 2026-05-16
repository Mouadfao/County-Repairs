'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/');
      router.refresh();
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:380, padding:'0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 14px' }}>🏢</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-.5px' }}>County Repairs</div>
          <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Internal Operations Portal</div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:16, padding:28 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              style={{ width:'100%', padding:'10px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:8, color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{ width:'100%', padding:'10px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:8, color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background:'#450a0a', border:'1px solid #7f1d1d', borderRadius:8, padding:'10px 12px', color:'#fca5a5', fontSize:13, marginBottom:16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width:'100%', padding:'11px', background: loading ? '#1e3a8a' : '#2563eb', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', transition:'background .2s' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#334155' }}>
          County Repairs · Secure Access
        </div>
      </div>
    </div>
  );
}
