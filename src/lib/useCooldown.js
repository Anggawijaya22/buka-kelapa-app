'use client';
import { useEffect, useState, useCallback } from 'react';

// Cooldown submit anti-spam WA — durasinya diambil dari /api/cooldown (diatur Developer
// di menu Pengaturan). Hook ini menghitung mundur di UI dan dipakai bareng oleh halaman
// Input Data dan History supaya tombol submit ke-disable selama masih cooldown.
export default function useCooldown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cooldown')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.remainingSeconds > 0) setRemaining(d.remainingSeconds); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(r => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const start = useCallback(seconds => setRemaining(seconds || 0), []);

  return { remaining, start };
}
