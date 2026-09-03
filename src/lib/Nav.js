'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconHome, IconEdit, IconActivity, IconAlertTriangle, IconSettings, IconClipboard, IconLogOut } from './icons';

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState('');

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

  const isSuper = role === 'superadmin';
  const isViewer = role === 'viewer';
  const isAdminShift = role === 'admin';
  const isAdminAtas = role === 'admin_atas';
  // superadmin (developer): semua menu + Log; Password/Ganti User/Dark Mode ada DI DALAM Pengaturan
  // admin (admin shift): Input Data (shift) + Monitoring (shift sendiri) + Pengaturan
  // admin_atas (admin atas): Input Data (rekap harian) + Monitoring (semua shift + rekap) + Pengaturan
  // viewer: hanya Approval + Pengaturan
  // Urutan sengaja: Pengaturan SELALU paling bawah (satu-satunya menu yang tampil di semua role).
  // Download Excel dipindah ke dalam menu Monitoring (lihat useDownloadExcel.js), tidak lagi di sini.
  const links = [
    { href: '/dashboard',    label: 'Dashboard',    icon: IconHome,          show: isSuper },
    { href: '/input',        label: 'Input Data',   icon: IconEdit,          show: isAdminShift || isAdminAtas || isSuper },
    { href: '/monitoring',   label: 'Monitoring',   icon: IconActivity,      show: isAdminShift || isAdminAtas || isSuper },
    { href: '/approval',     label: 'Approval',     icon: IconAlertTriangle, show: isViewer || isSuper },
    { href: '/log',          label: 'Log',          icon: IconClipboard,     show: isSuper },
    { href: '/pengaturan',   label: 'Pengaturan',   icon: IconSettings,      show: true },
  ];

  return (
    <>
      <button type="button" onClick={logout} className="btn-logout">
        <IconLogOut size={18} style={{ marginRight: 8 }} />Keluar
      </button>

      <div className="nav">
        {links.filter(l => l.show).map(l => (
          <a key={l.href} href={l.href} className={pathname.startsWith(l.href) ? 'active' : ''}>
            <l.icon size={18} />
            <span>{l.label}</span>
          </a>
        ))}
      </div>
    </>
  );
}
