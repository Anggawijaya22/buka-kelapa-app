'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    sessionStorage.setItem('bk_role', data.role);
    sessionStorage.setItem('bk_shift', data.shift || '');
    const dest = (data.role === 'admin' || data.role === 'admin_atas') ? '/input' : data.role === 'viewer' ? '/approval' : '/dashboard';
    router.push(dest);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="/icon-192.png" alt="Buka Kelapa App" width={96} height={96} style={{ borderRadius: 22, marginBottom: 16 }} />
        <h1>Buka Kelapa App</h1>
        <p className="sub">Login untuk input laporan produksi</p>
        <form onSubmit={handleLogin}>
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button disabled={loading}>{loading ? 'Masuk...' : 'Masuk'}</button>
        </form>
      </div>
    </div>
  );
}
