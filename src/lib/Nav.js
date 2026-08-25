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
  // admin & viewer: Input Data (kecuali viewer), History, Password, Keluar
  // superadmin: semua menu
  // viewer & superadmin: Approval (ACC/Reject data anomali)

  const links = [
    { href: '/dashboard', label: 'Dashboard', show: isSuper },
    { href: '/input',     label: 'Input Data', show: role === 'admin' || isSuper },
    { href: '/history',   label: 'History',    show: true },
    { href: '/approval',  label: '⚠️ Approval', show: isViewer || isSuper },
    { href: '/password',  label: 'Password',   show: true },
    { href: '/users',     label: 'Users',      show: isSuper },
  ];

  return (
    <div className="nav">
      {links.filter(l => l.show).map(l => (
        <a key={l.href} href={l.href} className={pathname.startsWith(l.href) ? 'active' : ''}>{l.label}</a>
      ))}
      <a href="#" onClick={e => { e.preventDefault(); logout(); }} style={{ marginLeft: 'auto', color: '#dc2626' }}>Keluar</a>
    </div>
  );
}
