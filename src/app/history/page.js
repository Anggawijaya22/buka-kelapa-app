'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState('');
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setRole(sessionStorage.getItem('bk_role') || '');
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const res = await fetch('/api/logs');
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const d = await res.json();
    setLogs(d.logs || []);
    setLoading(false);
  }

  async function hapusLog() {
    if (!confirm('Hapus SEMUA log aktivitas? Tindakan ini tidak bisa dibatalkan.')) return;
    setClearing(true);
    setMsg('');
    const res = await fetch('/api/logs', { method: 'DELETE' });
    const d = await res.json();
    setClearing(false);
    if (!res.ok) { setMsg('❌ ' + d.error); return; }
    setMsg('✅ Semua log berhasil dihapus');
    setLogs([]);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1>History Aktivitas</h1>
        {role === 'superadmin' && (
          <button
            className="danger"
            disabled={clearing || logs.length === 0}
            onClick={hapusLog}
            style={{ width: 'auto', padding: '8px 16px', fontSize: 13, marginTop: 0 }}
          >
            {clearing ? 'Menghapus...' : '🗑️ Hapus Log'}
          </button>
        )}
      </div>
      {msg && <p style={{ fontSize: 13, marginBottom: 8, color: msg.startsWith('✅') ? 'var(--primary)' : '#dc2626' }}>{msg}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
        {loading && <p>Memuat...</p>}
        {!loading && logs.length === 0 && <p className="sub">Belum ada aktivitas</p>}
        {logs.length > 0 && (
          <table>
            <thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Detail</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{l.username}</td>
                  <td>{l.action}</td>
                  <td>{l.detail ? JSON.stringify(l.detail) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
