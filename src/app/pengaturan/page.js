'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';

export default function PengaturanPage() {
  const [cooldownMinutes, setCooldownMinutes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/settings');
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
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
      <h1>⚙️ Pengaturan</h1>
      <p className="sub">Pengaturan aplikasi khusus Developer</p>

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
    </div>
  );
}
