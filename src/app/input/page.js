'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';
import CooldownNotice from '@/lib/CooldownNotice';
import useCooldown from '@/lib/useCooldown';
import useResultModal from '@/lib/useResultModal';

const DISMISS_KEY = 'bk_dismissed_approvals';

function todayDisplay() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function targetLabelSingkat(item) {
  if (item.target === 'rekap') return 'Rekap Harian';
  return 'Shift ' + item.target.slice(-1) + (item.waktu ? ' (' + item.waktu.toUpperCase() + ')' : '');
}

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
  } catch {}
}

function PengajuanSaya() {
  const [items, setItems] = useState([]);
  const dismissedRef = useRef(new Set());

  async function load() {
    const res = await fetch('/api/approvals?mine=true');
    if (!res.ok) return;
    const d = await res.json();
    // Hanya tampilkan yang masih pending, atau rejected yang belum pernah ditutup
    // (status "ditutup" disimpan permanen di localStorage, jadi tidak muncul lagi
    // walau logout/login ulang atau reload halaman)
    const relevant = (d.items || []).filter(it => it.status === 'pending' || (it.status === 'rejected' && !dismissedRef.current.has(it.id)));
    setItems(relevant);
  }

  function tutup(id) {
    dismissedRef.current.add(id);
    saveDismissed(dismissedRef.current);
    setItems(prev => prev.filter(it => it.id !== id));
  }

  useEffect(() => {
    dismissedRef.current = loadDismissed();
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      {items.map(it => (
        <div key={it.id} className="card" style={{ borderColor: it.status === 'pending' ? 'var(--warn)' : 'var(--danger)' }}>
          {it.status === 'pending' && (
            <p style={{ fontSize: 14 }}>⏳ <b>{targetLabelSingkat(it)}</b> ({it.tanggal}) sedang menunggu approval Viewer karena ada anomali.</p>
          )}
          {it.status === 'rejected' && (
            <>
              <p style={{ fontSize: 14, marginBottom: 8 }}>❌ <b>{targetLabelSingkat(it)}</b> ({it.tanggal}) di-<b>reject</b> oleh {it.resolved_by_username}. Mohon cek kembali dan kirim ulang.</p>
              <button type="button" className="secondary" onClick={() => tutup(it.id)}>Mengerti, tutup</button>
            </>
          )}
        </div>
      ))}
    </>
  );
}

export default function InputPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [myShift, setMyShift] = useState('');
  const [shift, setShift] = useState('');
  const [waktu, setWaktu] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = sessionStorage.getItem('bk_role') || '';
    const s = sessionStorage.getItem('bk_shift') || '';
    setRole(r);
    setMyShift(s);
    // Admin dengan shift sudah diset: langsung terkunci ke shift-nya sendiri
    if (r === 'admin' && s) setShift(s);
  }, []);

  const isAdminAtas = role === 'admin_atas';
  const shiftOptions = isAdminAtas ? [] : role === 'admin' ? (myShift ? [myShift] : []) : ['shiftA', 'shiftB', 'shiftC'];

  const [loadingRekapLibur, setLoadingRekapLibur] = useState(false);
  const cooldown = useCooldown();
  const { modal: resultModal, showSuccess, showError } = useResultModal();

  const WAKTU_EMOJI = { pagi: '🌅', siang: '☀️', malam: '🌙' };

  function goToForm() {
    router.push(`/input/form?target=${shift}&waktu=${waktu}`);
  }

  async function doKirimLibur() {
    if (cooldown.remaining > 0) return;
    setLoading(true);
    const res = await fetch('/api/libur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: shift, waktu, tanggal: todayDisplay() })
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (d.cooldownRemainingSeconds) cooldown.start(d.cooldownRemainingSeconds);
      showError(d.error, doKirimLibur);
      return;
    }
    if (d.cooldownSeconds) cooldown.start(d.cooldownSeconds);
    showSuccess('Notifikasi LIBUR PRODUKSI terkirim ke Bos');
  }

  function kirimLibur() {
    if (cooldown.remaining > 0) return;
    if (!confirm(`Kirim notifikasi LIBUR PRODUKSI untuk Shift ${shift.slice(-1)} (${waktu.toUpperCase()})?\n\nTanggal: ${todayDisplay()}\nPesan akan langsung terkirim ke WhatsApp Bos, dan data Excel Shift ${shift.slice(-1)} akan DIKOSONGKAN.`)) return;
    doKirimLibur();
  }

  async function doKirimLiburRekap() {
    if (cooldown.remaining > 0) return;
    setLoadingRekapLibur(true);
    const res = await fetch('/api/libur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'rekap', tanggal: todayDisplay() })
    });
    const d = await res.json();
    setLoadingRekapLibur(false);
    if (!res.ok) {
      if (d.cooldownRemainingSeconds) cooldown.start(d.cooldownRemainingSeconds);
      showError(d.error, doKirimLiburRekap);
      return;
    }
    if (d.cooldownSeconds) cooldown.start(d.cooldownSeconds);
    showSuccess('Notifikasi LIBUR PRODUKSI (Rekap) terkirim ke Bos');
  }

  function kirimLiburRekap() {
    if (cooldown.remaining > 0) return;
    if (!confirm('Kirim notifikasi LIBUR PRODUKSI untuk Rekap Harian (ketiga shift libur)?\n\nPesan akan langsung terkirim ke WhatsApp Bos.')) return;
    doKirimLiburRekap();
  }

  return (
    <div className="container">
      <Nav />
      {resultModal}
      <h1>Input Data</h1>
      <p className="sub">{isAdminAtas ? 'Isi rekap harian produksi' : 'Pilih shift dan waktu produksi'}</p>

      <PengajuanSaya />

      {role === 'admin' && !myShift && (
        <div className="card">
          <p className="error">Shift Anda belum diset oleh developer. Hubungi developer untuk bisa input data.</p>
        </div>
      )}

      {shiftOptions.length > 0 && (
        <div className="card">
          <h2>1️⃣ Pilih Shift</h2>
          <div className="grid3">
            {shiftOptions.map(s => (
              <button key={s} type="button"
                className={shift === s ? '' : 'secondary'}
                style={{ marginTop: 8 }}
                onClick={() => setShift(s)}>
                Shift {s.slice(-1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {shift && (
        <div className="card">
          <h2>2️⃣ Pilih Waktu</h2>
          <div className="grid3">
            {['pagi', 'siang', 'malam'].map(w => (
              <button key={w} type="button"
                className={waktu === w ? '' : 'secondary'}
                style={{ marginTop: 8 }}
                onClick={() => setWaktu(w)}>
                {WAKTU_EMOJI[w]} {w.charAt(0).toUpperCase() + w.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {shift && waktu && (
        <div className="card">
          <h2>3️⃣ Lanjut</h2>
          <p className="sub">Shift {shift.slice(-1)} — {WAKTU_EMOJI[waktu]} {waktu.toUpperCase()}</p>
          <button onClick={goToForm}>📝 Isi Data Produksi</button>
          <button className="danger" disabled={loading || cooldown.remaining > 0} onClick={kirimLibur}>
            {loading ? 'Mengirim...' : '⛔ LIBUR PRODUKSI (kirim notif)'}
          </button>
          <CooldownNotice seconds={cooldown.remaining} />
        </div>
      )}

      {role !== 'admin' && (
        <div className="card">
          <h2>📋 Rekap Harian</h2>
          <p className="sub">Rekap gabungan semua shift — kirim manual</p>
          <button className="secondary" onClick={() => router.push('/input/form?target=rekap')}>
            📝 Isi Rekap Harian
          </button>
          <button className="danger" disabled={loadingRekapLibur || cooldown.remaining > 0} onClick={kirimLiburRekap} style={{ marginTop: 8 }}>
            {loadingRekapLibur ? 'Mengirim...' : '⛔ LIBUR (Ketiga Shift) — kirim notif'}
          </button>
          <CooldownNotice seconds={cooldown.remaining} />
        </div>
      )}
    </div>
  );
}
