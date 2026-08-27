'use client';
import { useEffect, useRef, useState } from 'react';
import Nav from '@/lib/Nav';
import { SHIFT_LABELS } from '@/lib/excel-map';

const POLL_MS = 4000;

function targetLabel(item) {
  if (item.target === 'rekap') return '📋 Rekap Harian';
  return `${SHIFT_LABELS[item.target] || item.target}${item.waktu ? ' — ' + item.waktu.toUpperCase() : ''}`;
}

export default function ApprovalPage() {
  const [items, setItems] = useState([]);
  const [forbidden, setForbidden] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const audioCtxRef = useRef(null);
  const knownIdsRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  function playBeep() {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.start();
      o.stop(ctx.currentTime + 0.6);
      // beep kedua biar lebih kedengaran, mirip notif WA
      setTimeout(() => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.frequency.value = 1046;
        g2.gain.setValueAtTime(0.0001, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        o2.start();
        o2.stop(ctx.currentTime + 0.5);
      }, 180);
    } catch {}
  }

  async function aktifkanNotifikasi() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      setSoundOn(true);
      playBeep();
    } catch {}
  }

  async function load() {
    const res = await fetch('/api/approvals');
    if (res.status === 403) { setForbidden(true); return; }
    if (!res.ok) return;
    const d = await res.json();
    const list = d.items || [];

    if (!firstLoadRef.current) {
      const newOnes = list.filter(it => !knownIdsRef.current.has(it.id));
      if (newOnes.length > 0) {
        playBeep();
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('⚠️ Data Anomali Menunggu Approval', {
              body: `${newOnes.length} data baru menunggu ACC/Reject`,
              tag: 'bk-approval'
            });
          } catch {}
        }
      }
    }
    knownIdsRef.current = new Set(list.map(it => it.id));
    firstLoadRef.current = false;
    setItems(list);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function acc(id) {
    setBusyId(id);
    setNotice('');
    const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' });
    const d = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setNotice(`⚠️ ${d.error}`);
      load();
      return;
    }
    setNotice(`✅ Data berhasil di-ACC dan dikirim ke Excel (${d.cellsWritten} cell)`);
    load();
  }

  async function reject(id) {
    if (!confirm('Yakin reject data ini? Admin akan diminta merevisi ulang.')) return;
    setBusyId(id);
    setNotice('');
    const res = await fetch(`/api/approvals/${id}/reject`, { method: 'POST' });
    const d = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setNotice(`⚠️ ${d.error}`);
      load();
      return;
    }
    setNotice('✅ Data direject, admin akan diminta revisi');
    load();
  }

  if (forbidden) {
    return (
      <div className="container">
        <Nav />
        <div className="card"><p className="error">Halaman ini hanya untuk Viewer/Developer</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <Nav />
      <h1>⚠️ Approval Anomali</h1>
      <p className="sub">Data dengan EF WM di luar range normal menunggu persetujuan Anda</p>

      {!soundOn && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <p style={{ marginBottom: 12, fontSize: 14 }}>🔔 Aktifkan notifikasi supaya Anda dapat suara & alert saat ada data baru masuk (selama aplikasi ini terbuka).</p>
          <button onClick={aktifkanNotifikasi}>🔔 Aktifkan Notifikasi</button>
        </div>
      )}

      {notice && <div className="card"><p className={notice.startsWith('✅') ? 'success' : 'error'}>{notice}</p></div>}

      {items.length === 0 && (
        <div className="card"><p className="sub">Tidak ada data menunggu approval saat ini 🎉</p></div>
      )}

      {items.map(item => (
        <div key={item.id} className="card">
          <h2>{targetLabel(item)}</h2>
          <p className="sub">📅 {item.tanggal} · diajukan oleh <b>{item.submitted_by_username}</b></p>
          {item.ef_wm_preview !== null && (
            <p style={{ fontSize: 14, marginBottom: 4 }}>EF WM diperkirakan: <b>{Number(item.ef_wm_preview).toFixed(4).replace('.', ',')}</b></p>
          )}
          {item.anomali_reason && (
            <p style={{ fontSize: 13, color: 'var(--warn)', whiteSpace: 'pre-line', marginBottom: 8 }}>{item.anomali_reason}</p>
          )}
          {item.catatan && (
            <div className="card" style={{ background: 'var(--bg)', padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>📝 Catatan dari {item.submitted_by_username}:</p>
              <p style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{item.catatan}</p>
            </div>
          )}
          <button disabled={busyId === item.id} onClick={() => acc(item.id)}>
            {busyId === item.id ? 'Memproses...' : '✅ ACC — Kirim ke Excel'}
          </button>
          <button type="button" className="danger" disabled={busyId === item.id} onClick={() => reject(item.id)}>
            ❌ Reject — Minta Revisi
          </button>
        </div>
      ))}
    </div>
  );
}
