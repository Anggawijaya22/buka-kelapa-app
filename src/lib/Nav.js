'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState('');

  useEffect(() => {
    setRole(sessionStorage.getItem('bk_role') || '');
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
  // superadmin (developer): semua menu
  // admin (admin shift): Input Data (shift) + History (shift sendiri) + Password
  // admin_atas (admin atas): Input Data (rekap harian) + History (semua shift + rekap) + Password
  // viewer: hanya Approval + Password

  const links = [
    { href: '/dashboard',   label: 'Dashboard',    show: isSuper },
    { href: '/input',       label: 'Input Data',   show: isAdminShift || isAdminAtas || isSuper },
    { href: '/history',     label: 'History',      show: isAdminShift || isAdminAtas || isSuper },
    { href: '/approval',    label: '⚠️ Approval',  show: isViewer || isSuper },
    { href: '/password',    label: 'Password',     show: true },
    { href: '/api/excel/download', label: '⬇️ Download Excel', show: true, download: true },
    { href: '/users',       label: 'Users',        show: isSuper },
    { href: '/pengaturan',  label: '⚙️ Pengaturan', show: isSuper },
  ];

  return (
    <div className="nav">
      {links.filter(l => l.show).map(l => (
        <a key={l.href} href={l.href} download={l.download || undefined} className={!l.download && pathname.startsWith(l.href) ? 'active' : ''}>{l.label}</a>
      ))}
      <a href="#" onClick={e => { e.preventDefault(); logout(); }} style={{ marginLeft: 'auto', color: '#dc2626' }}>Keluar</a>
    </div>
  );
}
