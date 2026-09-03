'use client';
import { useState } from 'react';
import { IconDownload } from './icons';

const OVERLAY_STYLE = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
};

// Download file Excel OneDrive apa adanya (dipindah dari Nav ke dalam menu Monitoring).
// Popup konfirmasi "Apakah Anda yakin..." → overlay "sedang didownload" sambil fetch blob-nya.
export default function useDownloadExcel() {
  const [state, setState] = useState(null); // null | 'confirm' | 'downloading'

  async function doDownload() {
    setState('downloading');
    try {
      const res = await fetch('/api/excel/download');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Gagal download file Excel');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : 'Laporan-Produksi.xlsx';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Gagal download file Excel: ' + e.message);
    } finally {
      setState(null);
    }
  }

  const modal = state ? (
    <div style={OVERLAY_STYLE}>
      {state === 'confirm' ? (
        <div className="card" style={{ maxWidth: 360, width: '100%', margin: 0, textAlign: 'center' }}>
          <h2><IconDownload size={18} style={{ marginRight: 6 }} />Download Excel</h2>
          <p style={{ fontSize: 14, marginBottom: 4 }}>Apakah Anda yakin akan mendownload file Excel?</p>
          <button onClick={doDownload}>Ya</button>
          <button type="button" className="secondary" onClick={() => setState(null)}>Tidak</button>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 360, width: '100%', margin: 0, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>File sedang didownload, Silahkan tunggu...</p>
        </div>
      )}
    </div>
  ) : null;

  return { modal, askDownload: () => setState('confirm') };
}
