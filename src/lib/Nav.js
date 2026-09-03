'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const OVERLAY_STYLE = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
};

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState('');
  const [downloadState, setDownloadState] = useState(null); // null | 'confirm' | 'downloading'

  useEffect(() => {
    setRole(sessionStorage.getItem('bk_role') || '');
    // Tandai body supaya CSS bisa geser .container ke kanan sidebar khusus di halaman yang
    // punya Nav (bukan halaman login, yang tidak merender <Nav/> sama sekali) — lihat
    // "body.has-sidebar" di globals.css.
    document.body.classList.add('has-sidebar');
    return () => document.body.classList.remove('has-sidebar');
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.clear();
    router.push('/');
  }

  async function doDownload() {
    setDownloadState('downloading');
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
      setDownloadState(null);
    }
  }

  const isSuper = role === 'superadmin';
  const isViewer = role === 'viewer';
  const isAdminShift = role === 'admin';
  const isAdminAtas = role === 'admin_atas';
  // superadmin (developer): semua menu + Log; Password/Ganti User/Dark Mode ada DI DALAM Pengaturan
  // admin (admin shift): Input Data (shift) + Monitoring (shift sendiri) + Pengaturan
  // admin_atas (admin atas): Input Data (rekap harian) + Monitoring (semua shift + rekap) + Pengaturan
  // viewer: hanya Approval + Pengaturan

  const links = [
    { href: '/dashboard',    label: 'Dashboard',      show: isSuper },
    { href: '/input',        label: 'Input Data',     show: isAdminShift || isAdminAtas || isSuper },
    { href: '/monitoring',   label: 'Monitoring',     show: isAdminShift || isAdminAtas || isSuper },
    { href: '/approval',     label: '⚠️ Approval',    show: isViewer || isSuper },
    { href: '/pengaturan',   label: '⚙️ Pengaturan',  show: true },
    { href: '/log',          label: '📋 Log',         show: isSuper },
  ];

  return (
    <>
      <button type="button" onClick={logout} className="btn-logout">
        🚪 Keluar
      </button>

      <div className="nav">
        {links.filter(l => l.show).map(l => (
          <a key={l.href} href={l.href} className={pathname.startsWith(l.href) ? 'active' : ''}>{l.label}</a>
        ))}
        <a href="#" onClick={e => { e.preventDefault(); setDownloadState('confirm'); }}>⬇️ Download Excel</a>
      </div>

      {downloadState === 'confirm' && (
        <div style={OVERLAY_STYLE}>
          <div className="card" style={{ maxWidth: 360, width: '100%', margin: 0, textAlign: 'center' }}>
            <h2>⬇️ Download Excel</h2>
            <p style={{ fontSize: 14, marginBottom: 4 }}>Apakah Anda yakin akan mendownload file Excel?</p>
            <button onClick={doDownload}>Ya</button>
            <button type="button" className="secondary" onClick={() => setDownloadState(null)}>Tidak</button>
          </div>
        </div>
      )}

      {downloadState === 'downloading' && (
        <div style={OVERLAY_STYLE}>
          <div className="card" style={{ maxWidth: 360, width: '100%', margin: 0, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14 }}>File sedang didownload, Silahkan tunggu...</p>
          </div>
        </div>
      )}
    </>
  );
}
