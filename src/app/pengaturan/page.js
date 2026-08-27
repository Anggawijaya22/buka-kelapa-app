'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';
import { getTheme, setTheme } from '@/lib/theme';

const ROLE_LABELS = { superadmin: 'Developer', admin: 'Admin Shift', admin_atas: 'Admin Atas', viewer: 'Viewer' };

// --- Ganti Password — semua role ---
function GantiPasswordSection() {
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (newPassword !== confirm) {
      setMsg({ type: 'error', text: 'Konfirmasi password tidak sama' });
      return;
    }
    setLoading(true);
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setMsg({ type: 'error', text: data.error }); return; }
    setMsg({ type: 'success', text: '✅ Password berhasil diganti' });
    setOld(''); setNew(''); setConfirm('');
  }

  return (
    <div className="card">
      <h2>Ganti Password</h2>
      <p className="sub">Ubah password akun kamu sendiri</p>
      <form onSubmit={submit}>
        <label>Password Lama</label>
        <input type="password" value={oldPassword} onChange={e => setOld(e.target.value)} required />
        <label>Password Baru (min. 6 karakter)</label>
        <input type="password" value={newPassword} onChange={e => setNew(e.target.value)} required />
        <label>Konfirmasi Password Baru</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button disabled={loading}>{loading ? 'Menyimpan...' : 'Ganti Password'}</button>
      </form>
    </div>
  );
}

// --- Kelola User — khusus Developer ---
function KelolaUserSection() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [shift, setShift] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function load() {
    const res = await fetch('/api/users');
    if (!res.ok) return;
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

  return (
    <>
      <div className="card">
        <h2>Tambah User Baru</h2>
        <form onSubmit={addUser}>
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" required />
          <label>Password (min. 6 karakter)</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} required />
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="admin">Admin Shift</option>
            <option value="admin_atas">Admin Atas</option>
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
    </>
  );
}

// --- Cooldown Submit — khusus Developer ---
function CooldownSection() {
  const [cooldownMinutes, setCooldownMinutes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/settings');
    const d = await res.json();
    setCooldownMinutes(String(d.cooldownMinutes));
    setLoading(false);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cooldownMinutes: Number(cooldownMinutes) })
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return; }
    setMsg({ type: 'success', text: '✅ Pengaturan tersimpan' });
  }

  return (
    <div className="card">
      <h2>Cooldown Submit</h2>
      <p className="sub">
        Jeda minimal (menit) antar submit oleh Admin Shift / Admin Atas — mencegah notifikasi WA
        terkirim berulang kalau tombol submit ditekan berkali-kali. Developer tidak kena cooldown ini.
      </p>
      {loading ? <p>Memuat...</p> : (
        <form onSubmit={save}>
          <label>Cooldown (menit)</label>
          <input
            type="number" min="0" max="120" step="1"
            value={cooldownMinutes}
            onChange={e => setCooldownMinutes(e.target.value)}
            required
          />
          {msg.text && <p className={msg.type}>{msg.text}</p>}
          <button disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
        </form>
      )}
    </div>
  );
}

export default function PengaturanPage() {
  const [role, setRole] = useState('');
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    setRole(sessionStorage.getItem('bk_role') || '');
    setThemeState(getTheme());
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

  const isSuper = role === 'superadmin';

  return (
    <div className="container">
      <Nav />
      <h1>⚙️ Pengaturan</h1>
      <p className="sub">Tampilan, password, dan pengaturan akun Anda{isSuper ? ' — plus pengaturan khusus Developer' : ''}</p>

      <div className="card">
        <h2>Tampilan</h2>
        <p className="sub">Dark mode ini pilihan pribadi, tersimpan di HP/browser Anda sendiri.</p>
        <button type="button" className="secondary" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ Ganti ke Light Mode' : '🌙 Ganti ke Dark Mode'}
        </button>
      </div>

      <GantiPasswordSection />

      {isSuper && (
        <>
          <CooldownSection />
          <KelolaUserSection />
        </>
      )}
    </div>
  );
}
