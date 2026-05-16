'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [newUser, setNewUser] = useState({ username:'', password:'', role:'user' });
  const [adding,  setAdding]  = useState(false);
  const [addErr,  setAddErr]  = useState('');
  const [addOk,   setAddOk]   = useState(false);

  async function fetchUsers() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/users');
      if (res.status === 403) { setError('Access denied — admins only'); return; }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function toggleActive(user) {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: user.row, active: !user.active }),
    });
    if (res.ok) fetchUsers();
  }

  async function deleteUser(user) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: user.row }),
    });
    if (res.ok) fetchUsers();
  }

  async function addUser(e) {
    e.preventDefault();
    setAdding(true); setAddErr(''); setAddOk(false);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error || 'Failed to add user'); return; }
      setAddOk(true);
      setNewUser({ username:'', password:'', role:'user' });
      fetchUsers();
    } catch(e) { setAddErr(e.message); }
    finally { setAdding(false); }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method:'POST' });
    window.location.href = '/login';
  }

  const inp = (extra={}) => ({ padding:'8px 10px', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#fff', fontSize:13, outline:'none', ...extra });

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ background:'#1e293b', borderBottom:'1px solid #334155', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Link href="/" style={{ color:'#64748b', textDecoration:'none', fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
            <span>🏢</span><span>Portal</span><span style={{ margin:'0 4px' }}>/</span>
          </Link>
          <div style={{ width:28, height:28, borderRadius:6, background:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>👥</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>User Management</div>
        </div>
        <button onClick={logout} style={{ padding:'5px 12px', background:'transparent', border:'1px solid #334155', color:'#94a3b8', borderRadius:6, cursor:'pointer', fontSize:12 }}>
          Sign Out
        </button>
      </div>

      <div style={{ padding:'24px', maxWidth:900, margin:'0 auto' }}>

        {/* Add User Form */}
        <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:14, padding:24, marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:16 }}>➕ Add New User</div>
          <form onSubmit={addUser} style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:4, fontWeight:600 }}>USERNAME</label>
              <input value={newUser.username} onChange={e=>setNewUser({...newUser,username:e.target.value})}
                placeholder="e.g. john" required style={inp({width:140})} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:4, fontWeight:600 }}>PASSWORD</label>
              <input value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}
                placeholder="e.g. Pass@2026" required style={inp({width:160})} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:4, fontWeight:600 }}>ROLE</label>
              <select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})} style={inp({width:180,cursor:'pointer'})}>
                <option value="admin">Admin</option>
                <option value="upsellers_manager">Upsellers Manager</option>
                <option value="verification_manager">Verification Manager</option>
              </select>
            </div>
            <button type="submit" disabled={adding}
              style={{ padding:'8px 20px', background:'#2563eb', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              {adding ? 'Adding…' : 'Add User'}
            </button>
          </form>
          {addErr && <div style={{ marginTop:10, fontSize:13, color:'#fca5a5' }}>❌ {addErr}</div>}
          {addOk  && <div style={{ marginTop:10, fontSize:13, color:'#86efac' }}>✅ User added successfully!</div>}
        </div>

        {/* Users Table */}
        <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #334155', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>👥 All Users ({users.length})</div>
            <button onClick={fetchUsers} style={{ padding:'4px 12px', background:'transparent', border:'1px solid #334155', color:'#94a3b8', borderRadius:6, cursor:'pointer', fontSize:12 }}>↻ Refresh</button>
          </div>

          {loading && <div style={{ padding:40, textAlign:'center', color:'#64748b' }}>Loading…</div>}
          {error   && <div style={{ padding:20, color:'#fca5a5', fontSize:13 }}>❌ {error}</div>}

          {!loading && !error && users.length === 0 && (
            <div style={{ padding:40, textAlign:'center', color:'#64748b', fontSize:14 }}>
              No users yet — add your first user above.
            </div>
          )}

          {!loading && users.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #334155' }}>
                  {['Username','Role','Status','Active','Delete'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u,i) => (
                  <tr key={u.row} style={{ borderBottom:'1px solid #1e293b', background: i%2===0?'transparent':'#0f172a11' }}>
                    <td style={{ padding:'12px 16px', color:'#fff', fontWeight:500 }}>{u.username}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
                        background: u.role==='admin'?'#4c1d95':u.role==='upsellers_manager'?'#14532d':'#1e3a8a',
                        color: u.role==='admin'?'#c4b5fd':u.role==='upsellers_manager'?'#86efac':'#93c5fd' }}>
                        {u.role==='admin'?'Admin':u.role==='upsellers_manager'?'Upsellers Manager':'Verification Manager'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700,
                        background: u.active?'#14532d':'#450a0a',
                        color: u.active?'#86efac':'#fca5a5' }}>
                        {u.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      {/* Toggle switch */}
                      <div onClick={()=>toggleActive(u)}
                        style={{ width:44, height:24, borderRadius:12, background: u.active?'#16a34a':'#334155',
                          cursor:'pointer', position:'relative', transition:'background .2s' }}>
                        <div style={{ width:18, height:18, borderRadius:9, background:'#fff',
                          position:'absolute', top:3, left: u.active?23:3, transition:'left .2s' }}/>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <button onClick={()=>deleteUser(u)}
                        style={{ padding:'4px 10px', background:'transparent', border:'1px solid #7f1d1d', color:'#fca5a5', borderRadius:5, cursor:'pointer', fontSize:12 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ padding:'12px 16px', borderTop:'1px solid #334155', fontSize:11, color:'#475569' }}>
            💡 Toggle the switch to enable/disable a user instantly. Disabled users cannot log in.
          </div>
        </div>

      </div>
    </div>
  );
}
