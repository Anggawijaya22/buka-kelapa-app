'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';

function todayDisplay() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

export default function InputPage() {
  const router = useRouter();
  const [shift, setShift] = useState('');
  const [waktu, setWaktu] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const WAKTU_EMOJI = { pagi: '🌅', siang: '☀️', malam: '🌙' };

  function goToForm() {
    router.push(`/input/form?target=${shift}&waktu=${waktu}`);
  }

  async function kirimLibur() {
    if (!confirm(`Kirim notifikasi LIBUR PRODUKSI untuk Shift ${shift.slice(-1)} (${waktu.toUpperCase()})?\n\nPesan akan langsung terkirim ke WhatsApp Bos.`)) return;
    setLoading(true);
    setMsg({ type: '', text: '' });
    const res = await fetch('/api/libur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: shift, waktu, tanggal: todayDisplay() })
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setMsg({ type: 'error', text: d.error }); return; }
    setMsg({ type: 'success', text: '✅ Notifikasi LIBUR PRODUKSI terkirim ke Bos' });
  }

  return (
    <div className="container">
      <Nav />
      <h1>Input Data</h1>
      <p className="sub">Pilih shift dan waktu produksi</p>

      <div className="card">
        <h2>1️⃣ Pilih Shift</h2>
        <div className="grid3">
          {['shiftA', 'shiftB', 'shiftC'].map(s => (
            <button key={s} type="button"
              className={shift === s ? '' : 'secondary'}
              style={{ marginTop: 8 }}
              onClick={() => setShift(s)}>
              Shift {s.slice(-1)}
            </button>
          ))}
        </div>
      </div>

      {shift && (
        <div className="card">
          <h2>2️⃣ Pilih Waktu</h2>
          <div className="grid3">
            {['pagi', 'siang', 'malam'].map(w => (
              <button key={w} type="button"
                className={waktu === w ? '' : 'secondary'}
                style={{ marginTop: 8 }}
                onClick={() => setWaktu(w)}>
                {WAKTU_EMOJI[w]} {w.charAt(0).toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {shift && waktu && (
        <div className="card">
          <h2>3️⃣ Lanjut</h2>
          <p className="sub">Shift {shift.slice(-1)} — {WAKTU_EMOJI[waktu]} {waktu.toUpperCase()}</p>
          <button onClick={goToForm}>📝 Isi Data Produksi</button>
          <button className="danger" disabled={loading} onClick={kirimLibur}>
            {loading ? 'Mengirim...' : '⛔ LIBUR PRODUKSI (kirim notif)'}
          </button>
          {msg.text && <p className={msg.type}>{msg.text}</p>}
        </div>
      )}

      <div className="card">
        <h2>📋 Rekap Harian</h2>
        <p className="sub">Rekap gabungan semua shift — kirim manual</p>
        <button className="secondary" onClick={() => router.push('/input/form?target=rekap')}>
          Isi Rekap Harian
        </button>
      </div>
    </div>
  );
}
