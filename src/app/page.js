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
    router.push('/dashboard');
  }

  return (
    <div className="container" style={{ paddingTop: 60 }}>
      <div className="card">
        <h1>🥥 Buka Kelapa App</h1>
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
