'use client';
import { useState } from 'react';

// Modal konfirmasi anomali — dipakai berbasis Promise (mirip window.confirm tapi custom 2 tombol).
// Catatan WAJIB diisi kalau user pilih "Tetap Kirim" — supaya viewer/developer tahu alasan admin
// tetap mengirim data yang anomali. Dipakai bareng oleh form Input Data dan Monitoring.
export default function useAnomaliConfirm() {
  const [state, setState] = useState(null); // { message, resolve }
  const [catatan, setCatatan] = useState('');

  function confirmAnomali(message) {
    setCatatan('');
    return new Promise(resolve => {
      setState({ message, resolve });
    });
  }
  function handle(result) {
    state.resolve(result);
    setState(null);
  }

  const catatanKosong = catatan.trim() === '';

  const modal = state ? (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', margin: 0 }}>
        <h2 style={{ color: 'var(--warn)' }}>⚠️ Anomali Terdeteksi</h2>
        <p style={{ whiteSpace: 'pre-line', fontSize: 14, marginBottom: 4 }}>{state.message}</p>
        <label>Catatan (wajib diisi kalau tetap kirim)</label>
        <textarea
          rows={3}
          value={catatan}
          onChange={e => setCatatan(e.target.value)}
          placeholder="Contoh: sudah dicek ulang, memang segini hasilnya karena..."
          style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button disabled={catatanKosong} onClick={() => handle({ confirmed: true, catatan: catatan.trim() })}>✅ Tetap Kirim</button>
        <button type="button" className="secondary" onClick={() => handle({ confirmed: false })}>✏️ Revisi Data</button>
      </div>
    </div>
  ) : null;

  return [modal, confirmAnomali];
}
