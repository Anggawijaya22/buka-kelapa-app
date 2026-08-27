'use client';
import { useState } from 'react';

// Modal konfirmasi generik (Ya/Batal) berbasis Promise — dipakai utk "Yakin kirim data?"
// di form Input Data dan Monitoring.
export default function useConfirm() {
  const [state, setState] = useState(null); // { message, resolve }

  function confirm(message) {
    return new Promise(resolve => {
      setState({ message, resolve });
    });
  }
  function handle(result) {
    state.resolve(result);
    setState(null);
  }

  const modal = state ? (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
    }}>
      <div className="card" style={{ maxWidth: 360, width: '100%', margin: 0, textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{state.message}</p>
        <button onClick={() => handle(true)}>Ya</button>
        <button type="button" className="danger" onClick={() => handle(false)}>Batal</button>
      </div>
    </div>
  ) : null;

  return { modal, confirm };
}
