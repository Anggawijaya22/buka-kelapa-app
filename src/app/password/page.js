'use client';
import { useState } from 'react';
import Nav from '@/lib/Nav';

export default function PasswordPage() {
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
    <div className="container">
      <Nav />
      <h1>Ganti Password</h1>
      <p className="sub">Ubah password akun kamu sendiri</p>
      <div className="card">
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
    </div>
  );
}
