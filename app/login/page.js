'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SKY = 'linear-gradient(rgb(40,14,1) 0%, rgb(24,38,68) 15%, rgb(90,118,159) 30%, rgb(135,161,196) 43%, rgb(193,211,230) 58%, rgb(254,249,225) 79%, rgb(247,243,240) 100%)';
const SERIF = "'IBM Plex Serif', Georgia, serif";
const SANS  = "'Inter', system-ui, sans-serif";

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
      const res  = await fetch('/api/auth/login', {
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
    <div style={{ minHeight:'100vh', background:SKY, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:SANS, padding:24 }}>

      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontFamily:SERIF, fontSize:42, fontWeight:400, color:'#0c1018', letterSpacing:'-0.84px', lineHeight:1.05, marginBottom:8 }}>
            County Repairs
          </div>
          <div style={{ fontSize:13, color:'#6d7074', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:400 }}>
            Internal Operations Portal
          </div>
        </div>

        {/* Card */}
        <div style={{ background:'#fff', borderRadius:16, padding:'40px 36px', boxShadow:'0 4px 32px rgba(12,16,24,.08), 0 1px 4px rgba(12,16,24,.04)' }}>

          <form onSubmit={handleLogin}>
            {/* Username */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:500, color:'#9e9fa3', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e=>setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                style={{ width:'100%', padding:'14px 20px', background:'rgba(153,161,175,.06)', border:'1px solid rgba(153,161,175,.2)', borderRadius:50, color:'#0c1018', fontSize:15, fontFamily:SANS, outline:'none', boxSizing:'border-box', letterSpacing:'-0.15px' }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:500, color:'#9e9fa3', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ width:'100%', padding:'14px 20px', background:'rgba(153,161,175,.06)', border:'1px solid rgba(153,161,175,.2)', borderRadius:50, color:'#0c1018', fontSize:15, fontFamily:SANS, outline:'none', boxSizing:'border-box', letterSpacing:'-0.15px' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{ background:'#fef2f2', border:'1px solid rgba(228,108,68,.3)', borderRadius:8, padding:'10px 16px', color:'#c1121f', fontSize:13, marginBottom:16, letterSpacing:'-0.1px' }}>
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              style={{ width:'100%', padding:'14px 24px', background: loading ? 'rgba(153,161,175,.1)' : '#0c1018', color: loading ? '#9e9fa3' : '#fff', border:'none', borderRadius:90, fontSize:14, fontFamily:SANS, fontWeight:500, cursor: loading?'not-allowed':'pointer', letterSpacing:'-0.14px', transition:'all .2s' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:24, fontSize:11, color:'rgba(12,16,24,.35)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
          Secure Access · County Repairs
        </div>
      </div>
    </div>
  );
}
