'use client';
import { useEffect, useState } from 'react';
import Nav from '@/lib/Nav';
import { formatIsoDisplay } from '@/lib/dateDisplay';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const TARGET_LABELS = { SHIFTA: 'Shift A', SHIFTB: 'Shift B', SHIFTC: 'Shift C', REKAP: 'Rekap Harian' };
const WAKTU_LABELS = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

const SIMPLE_LABELS = {
  LOGIN: '🔑 Login',
  LOGOUT: '🚪 Logout',
  GANTI_PASSWORD: '🔒 Ganti Password',
  MS_CONNECTED: '🔗 Hubungkan Microsoft OneDrive',
  TAMBAH_USER: '➕ Tambah User',
  HAPUS_USER: '🗑️ Hapus User',
  RESET_PASSWORD_USER: '🔒 Reset Password User',
  UBAH_SHIFT_USER: '🔄 Ubah Shift User',
  UBAH_PENGATURAN: '⚙️ Ubah Pengaturan',
  KIRIM_LIBUR: '⛔ Kirim Notifikasi Libur',
  AJUKAN_ANOMALI: '⚠️ Ajukan Data Anomali',
  ACC_ANOMALI: '✅ ACC Data Anomali',
  REJECT_ANOMALI: '❌ Reject Data Anomali',
};

function targetLabelFrom(raw) {
  if (!raw) return '';
  if (raw === 'rekap') return 'Rekap Harian';
  return TARGET_LABELS[raw.toUpperCase()] || raw;
}

function extraTanggalWaktu(detail) {
  if (!detail) return '';
  const parts = [];
  if (detail.tanggal) parts.push(detail.tanggal);
  if (detail.waktu && WAKTU_LABELS[detail.waktu]) parts.push(WAKTU_LABELS[detail.waktu]);
  return parts.join(' · ');
}

function extraGeneric(action, detail) {
  if (!detail) return '';
  switch (action) {
    case 'TAMBAH_USER':
      return `${detail.username} (${detail.role}${detail.shift ? ', ' + detail.shift : ''})`;
    case 'HAPUS_USER':
    case 'RESET_PASSWORD_USER':
      return detail.username || '';
    case 'UBAH_SHIFT_USER':
      return `${detail.username} → ${detail.shift || '-'}`;
    case 'UBAH_PENGATURAN':
      return `Cooldown submit: ${detail.submit_cooldown_minutes} menit`;
    case 'KIRIM_LIBUR':
      return [targetLabelFrom(detail.target), detail.tanggal].filter(Boolean).join(' · ');
    case 'AJUKAN_ANOMALI':
    case 'ACC_ANOMALI':
    case 'REJECT_ANOMALI':
      return [targetLabelFrom(detail.target), detail.tanggal, detail.submittedBy ? 'oleh ' + detail.submittedBy : null].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

// Ubah action mentah (mis. "SUBMIT_SHIFTA_ACC") jadi label + info ringkas yang enak dibaca —
// detail lengkap input data sengaja tidak ditampilkan di sini (sudah ada di menu Monitoring).
function formatLog(log) {
  const { action, detail } = log;

  const submitMatch = action.match(/^SUBMIT_(SHIFTA|SHIFTB|SHIFTC|REKAP)(_ACC)?$/);
  if (submitMatch) {
    const label = `📝 Input Data ${TARGET_LABELS[submitMatch[1]]}${submitMatch[2] ? ' (via ACC Anomali)' : ''}`;
    return { label, info: extraTanggalWaktu(detail) };
  }

  const editMatch = action.match(/^EDIT_(SHIFTA|SHIFTB|SHIFTC|REKAP)$/);
  if (editMatch) {
    return { label: `✏️ Edit Data ${TARGET_LABELS[editMatch[1]]}`, info: extraTanggalWaktu(detail) };
  }

  const simpanMatch = action.match(/^SIMPAN_(SHIFTA|SHIFTB|SHIFTC|REKAP)$/);
  if (simpanMatch) {
    return { label: `💾 Simpan Draft ${TARGET_LABELS[simpanMatch[1]]}`, info: extraTanggalWaktu(detail) };
  }

  if (SIMPLE_LABELS[action]) {
    return { label: SIMPLE_LABELS[action], info: extraGeneric(action, detail) };
  }

  return { label: action, info: '' };
}

export default function LogPage() {
  const [logs, setLogs] = useState([]);
  const [tanggal, setTanggal] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/logs?tanggal=${tanggal}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const d = await res.json();
    setLogs(d.logs || []);
    setLoading(false);
  }

  if (forbidden) {
    return (
      <div className="container">
        <Nav />
        <div className="card"><p className="error">Halaman ini hanya untuk Developer</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <Nav />
      <h1>📋 Log Aktivitas</h1>
      <p className="sub">Riwayat aktivitas semua user — login, ganti password, kelola user, input/edit data, dll.</p>

      <div className="card">
        <label>Tanggal</label>
        <input type="date" value={tanggal} max={todayStr()} onChange={e => setTanggal(e.target.value)} />
        {tanggal && (
          <small style={{ display: 'block', marginTop: 4, color: 'var(--muted, #666)' }}>
            📅 {formatIsoDisplay(tanggal)} (format Indonesia: DD/MM/YYYY)
          </small>
        )}
        {tanggal && (
          <button type="button" className="secondary" style={{ width: 'auto', padding: '6px 14px', marginTop: 8 }} onClick={() => setTanggal('')}>
            Tampilkan Semua Tanggal
          </button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {loading && <p>Memuat...</p>}
        {!loading && logs.length === 0 && <p className="sub">Belum ada aktivitas</p>}
        {logs.length > 0 && (
          <table>
            <thead><tr><th>Waktu</th><th>User</th><th>Aktivitas</th><th>Info</th></tr></thead>
            <tbody>
              {logs.map(l => {
                const { label, info } = formatLog(l);
                return (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{l.username || '-'}</td>
                    <td>{label}</td>
                    <td style={{ color: 'var(--muted)' }}>{info}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
