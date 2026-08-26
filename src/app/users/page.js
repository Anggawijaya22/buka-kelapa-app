'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';

const ROLE_LABELS = { superadmin: 'Developer', admin: 'Admin', viewer: 'Viewer' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [shift, setShift] = useState('');
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
      body: JSON.stringify({ username, password, role, shift: role === 'admin' ? shift : null })
    });
    const d = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return; }
    setMsg({ type: 'success', text: '✅ User berhasil ditambahkan' });
    setUsername(''); setPassword(''); setShift('');
    load();
  }

  async function ubahShift(id, uname, currentShift) {
    const pilihan = prompt(`Shift baru untuk "${uname}" — ketik A, B, atau C:`, (currentShift || '').slice(-1));
    if (!pilihan) return;
    const s = 'shift' + pilihan.trim().toUpperCase();
    if (!['shiftA', 'shiftB', 'shiftC'].includes(s)) { alert('Ketik A, B, atau C saja'); return; }
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, shift: s })
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error); return; }
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
        <div className="card"><p className="error">Halaman ini hanya untuk Developer</p></div>
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
            <option value="superadmin">Developer</option>
            <option value="viewer">Viewer</option>
          </select>
          {role === 'admin' && (
            <>
              <label>Shift (admin hanya bisa input shift ini)</label>
              <select value={shift} onChange={e => setShift(e.target.value)} required>
                <option value="">-- Pilih Shift --</option>
                <option value="shiftA">Shift A</option>
                <option value="shiftB">Shift B</option>
                <option value="shiftC">Shift C</option>
              </select>
            </>
          )}
          {msg.text && <p className={msg.type}>{msg.text}</p>}
          <button>+ Tambah User</button>
        </form>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Daftar User</h2>
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Shift</th><th>Aksi</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td><span className={`badge ${u.role}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                <td>{u.role === 'admin' ? (u.shift ? 'Shift ' + u.shift.slice(-1) : '⚠️ belum diset') : '-'}</td>
                <td>
                  {u.role === 'admin' && (
                    <a href="#" onClick={e => { e.preventDefault(); ubahShift(u.id, u.username, u.shift); }} style={{ marginRight: 12 }}>Ubah Shift</a>
                  )}
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
