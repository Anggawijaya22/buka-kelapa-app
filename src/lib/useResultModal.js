'use client';
import { useState } from 'react';

// Popup "DATA BERHASIL DIKIRIM" / "DATA GAGAL DIKIRIM" — dipakai bareng oleh submit
// Input Data, Simpan Perubahan History, dan tombol LIBUR PRODUKSI.
export default function useResultModal() {
  const [state, setState] = useState(null); // { kind: 'success'|'error', message, onOk, onRetry }

  function showSuccess(message, onOk) {
    setState({ kind: 'success', message, onOk });
  }
  function showError(message, onRetry) {
    setState({ kind: 'error', message, onRetry });
  }
  function close() {
    setState(null);
  }

  const modal = state ? (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', margin: 0, textAlign: 'center' }}>
        <h2 style={{ color: state.kind === 'success' ? 'var(--primary)' : 'var(--danger)' }}>
          {state.kind === 'success' ? '✅ DATA BERHASIL DIKIRIM' : '❌ DATA GAGAL DIKIRIM'}
        </h2>
        {state.message && <p style={{ whiteSpace: 'pre-line', fontSize: 14, marginBottom: 4 }}>{state.message}</p>}
        {state.kind === 'success' ? (
          <button onClick={() => { const cb = state.onOk; close(); cb?.(); }}>OK</button>
        ) : (
          <>
            <button onClick={() => { const cb = state.onRetry; close(); cb?.(); }}>🔁 Kirim Ulang</button>
            <button type="button" className="secondary" onClick={close}>← Kembali</button>
          </>
        )}
      </div>
    </div>
  ) : null;

  return { modal, showSuccess, showError, close };
}
