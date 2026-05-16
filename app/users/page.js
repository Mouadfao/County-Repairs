'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const SERIF = "'IBM Plex Serif', Georgia, serif";
const SANS  = "'Inter', system-ui, sans-serif";
const BG    = '#f4f0eb';

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [newUser, setNewUser] = useState({ username:'', password:'', role:'admin' });
  const [adding,  setAdding]  = useState(false);
  const [addErr,  setAddErr]  = useState('');
  const [addOk,   setAddOk]   = useState(false);

  async function fetchUsers() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/users');
      if (res.status===403) { setError('Access denied — super admins only'); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users||[]);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ fetchUsers(); },[]);

  async function toggleActive(user) {
    await fetch('/api/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ row:user.row, active:!user.active }) });
    fetchUsers();
  }

  async function deleteUser(user) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    await fetch('/api/users', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ row:user.row }) });
    fetchUsers();
  }

  async function addUser(e) {
    e.preventDefault();
    setAdding(true); setAddErr(''); setAddOk(false);
    try {
      const res  = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newUser) });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error||'Failed to add user'); return; }
      setAddOk(true);
      setNewUser({ username:'', password:'', role:'admin' });
      fetchUsers();
    } catch(e) { setAddErr(e.message); }
    finally { setAdding(false); }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method:'POST' });
    window.location.href = '/login';
  }

  const roleLabel = r => r==='super_admin'?'Super Admin':r==='admin'?'Admin':r==='upsellers_manager'?'Upsellers Manager':'Verification Manager';
  const roleColor = r => r==='super_admin'?{bg:'rgba(92,75,138,.1)',color:'#5c4b8a'}:r==='admin'?{bg:'rgba(29,53,87,.1)',color:'#1d3557'}:r==='upsellers_manager'?{bg:'rgba(45,106,79,.1)',color:'#2d6a4f'}:{bg:'rgba(69,123,157,.1)',color:'#457b9d'};

  const inp = (extra={}) => ({ padding:'10px 16px', background:'rgba(153,161,175,.06)', border:'1px solid rgba(153,161,175,.2)', borderRadius:50, color:'#0c1018', fontSize:13, fontFamily:SANS, outline:'none', ...extra });

  return (
    <div style={{ minHeight:'100vh', background:BG, fontFamily:SANS }}>

      {/* HEADER */}
      <div style={{ background:'rgba(247,243,240,.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(153,161,175,.15)', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/" style={{ color:'#9e9fa3', textDecoration:'none', fontSize:12 }}>← Portal</Link>
          <span style={{ color:'rgba(153,161,175,.4)', fontSize:12 }}>/</span>
          <span style={{ fontFamily:SERIF, fontSize:18, fontWeight:400, color:'#0c1018', letterSpacing:'-0.36px' }}>User Management</span>
        </div>
        <button onClick={logout} style={{ padding:'7px 20px', background:'transparent', border:'1px solid rgba(153,161,175,.25)', color:'#6d7074', borderRadius:90, cursor:'pointer', fontSize:12, fontFamily:SANS }}>Sign Out</button>
      </div>

      <div style={{ padding:'28px', maxWidth:920, margin:'0 auto' }}>

        {/* ADD USER */}
        <div style={{ background:'#fff', border:'1px solid rgba(153,161,175,.12)', borderRadius:16, padding:'24px 28px', marginBottom:24, boxShadow:'0 1px 4px rgba(12,16,24,.06)' }}>
          <div style={{ fontFamily:SERIF, fontSize:18, fontWeight:400, color:'#0c1018', letterSpacing:'-0.36px', marginBottom:20 }}>Add New User</div>
          <form onSubmit={addUser} style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <div style={{ fontSize:10, color:'#9e9fa3', fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Username</div>
              <input value={newUser.username} onChange={e=>setNewUser({...newUser,username:e.target.value})} placeholder="e.g. john" required style={inp({width:140})} />
            </div>
            <div>
              <div style={{ fontSize:10, color:'#9e9fa3', fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Password</div>
              <input value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})} placeholder="e.g. Pass@2026" required style={inp({width:160})} />
            </div>
            <div>
              <div style={{ fontSize:10, color:'#9e9fa3', fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Role</div>
              <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={inp({width:180,cursor:'pointer'})}>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="upsellers_manager">Upsellers Manager</option>
                <option value="verification_manager">Verification Manager</option>
              </select>
            </div>
            <button type="submit" disabled={adding} style={{ padding:'10px 24px', background:'#0c1018', color:'#fff', border:'none', borderRadius:90, cursor:'pointer', fontSize:13, fontFamily:SANS, fontWeight:500, opacity:adding?.6:1 }}>
              {adding ? 'Adding…' : 'Add User'}
            </button>
          </form>
          {addErr && <div style={{ marginTop:12, fontSize:12, color:'#c1121f', letterSpacing:'-0.12px' }}>❌ {addErr}</div>}
          {addOk  && <div style={{ marginTop:12, fontSize:12, color:'#2d6a4f', letterSpacing:'-0.12px' }}>✓ User added successfully</div>}
        </div>

        {/* USERS TABLE */}
        <div style={{ background:'#fff', border:'1px solid rgba(153,161,175,.12)', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(12,16,24,.06)' }}>
          <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(153,161,175,.12)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontFamily:SERIF, fontSize:18, fontWeight:400, color:'#0c1018', letterSpacing:'-0.36px' }}>
              All Users <span style={{ fontSize:13, color:'#9e9fa3', fontFamily:SANS, fontWeight:400 }}>({users.length})</span>
            </div>
            <button onClick={fetchUsers} style={{ padding:'5px 14px', background:'rgba(153,161,175,.08)', border:'1px solid rgba(153,161,175,.2)', color:'#6d7074', borderRadius:90, cursor:'pointer', fontSize:12, fontFamily:SANS }}>↻ Refresh</button>
          </div>

          {loading && <div style={{ padding:40, textAlign:'center', color:'#9e9fa3', fontSize:13 }}>Loading…</div>}
          {error   && <div style={{ padding:20, color:'#c1121f', fontSize:13 }}>❌ {error}</div>}

          {!loading && !error && users.length===0 && (
            <div style={{ padding:48, textAlign:'center', color:'#9e9fa3', fontSize:13, letterSpacing:'-0.13px' }}>
              No users yet — add your first user above.
            </div>
          )}

          {!loading && users.length>0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Username','Role','Status','Access','Remove'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#9e9fa3', fontWeight:500, fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid rgba(153,161,175,.12)', background:'rgba(153,161,175,.04)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u,i)=>{
                  const rc = roleColor(u.role);
                  return (
                    <tr key={u.row} style={{ borderBottom:'1px solid rgba(153,161,175,.08)' }}>
                      <td style={{ padding:'12px 16px', color:'#0c1018', fontWeight:500 }}>{u.username}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:90, fontSize:11, fontWeight:500, background:rc.bg, color:rc.color }}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:90, fontSize:11, fontWeight:500, background:u.active?'rgba(45,106,79,.1)':'rgba(193,18,31,.08)', color:u.active?'#2d6a4f':'#c1121f' }}>
                          {u.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <div onClick={()=>toggleActive(u)} style={{ width:40, height:22, borderRadius:11, background:u.active?'#2d6a4f':'rgba(153,161,175,.25)', cursor:'pointer', position:'relative', transition:'background .2s' }}>
                          <div style={{ width:16, height:16, borderRadius:8, background:'#fff', position:'absolute', top:3, left:u.active?21:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(12,16,24,.2)' }}/>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <button onClick={()=>deleteUser(u)} style={{ padding:'4px 12px', background:'transparent', border:'1px solid rgba(193,18,31,.2)', color:'#c1121f', borderRadius:90, cursor:'pointer', fontSize:11, fontFamily:SANS }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(153,161,175,.1)', fontSize:11, color:'#9e9fa3', letterSpacing:'-0.11px' }}>
            Toggle access switch to enable or disable a user instantly. Disabled users cannot sign in.
          </div>
        </div>
      </div>
    </div>
  );
}
