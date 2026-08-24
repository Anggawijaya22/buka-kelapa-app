'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    const res = await fetch('/api/users');
    if (res.status === 403) { setForbidden(true); return; }
    const d = await res.json();
    setUsers(d.users || []);
  }
  useEffect(() => { load(); }, []);

  async function addUser(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });
    const d = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return; }
    setMsg({ type: 'success', text: '✅ User berhasil ditambahkan' });
    setUsername(''); setPassword('');
    load();
  }

  async function delUser(id, uname) {
    if (!confirm(`Hapus user "${uname}"?`)) return;
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error); return; }
    load();
  }

  async function resetPass(id, uname) {
    const np = prompt(`Password baru untuk "${uname}" (min. 6 karakter):`);
    if (!np) return;
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: np })
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error); return; }
    alert('Password berhasil direset');
  }

  if (forbidden) {
    return (
      <div className="container">
        <Nav />
        <div className="card"><p className="error">Halaman ini hanya untuk Superadmin</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <Nav />
      <h1>Kelola User</h1>
      <p className="sub">Tambah, hapus, dan reset password admin</p>

      <div className="card">
        <h2>Tambah User Baru</h2>
        <form onSubmit={addUser}>
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" required />
          <label>Password (min. 6 karakter)</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} required />
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
            <option value="viewer">Viewer</option>
          </select>
          {msg.text && <p className={msg.type}>{msg.text}</p>}
          <button>+ Tambah User</button>
        </form>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Daftar User</h2>
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Aksi</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td><span className={`badge ${u.role}`}>{u.role}</span></td>
                <td>
                  <a href="#" onClick={e => { e.preventDefault(); resetPass(u.id, u.username); }} style={{ marginRight: 12 }}>Reset</a>
                  <a href="#" onClick={e => { e.preventDefault(); delUser(u.id, u.username); }} style={{ color: '#dc2626' }}>Hapus</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
