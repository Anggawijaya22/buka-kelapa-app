'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';
import ProductionFormFields, { emptyPh, phToPayload, validateProductionForm } from '@/lib/ProductionFormFields';
import CooldownNotice from '@/lib/CooldownNotice';
import useCooldown from '@/lib/useCooldown';
import useResultModal from '@/lib/useResultModal';

const WAKTU_EMOJI = { pagi: '🌅', siang: '☀️', malam: '🌙' };

// Sama persis dengan range di n8n — supaya deteksi anomali di app cocok dengan yang di WA
const RANGE_MIN = 0.33;
const RANGE_MAX = 0.361;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function toExcelDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
function toIDDecimal(n) {
  return n.toFixed(4).replace('.', ',');
}

// Modal konfirmasi anomali — dipakai berbasis Promise (mirip window.confirm tapi custom 2 tombol).
// Catatan WAJIB diisi kalau user pilih "Tetap Kirim" — supaya viewer/developer tahu alasan admin
// tetap mengirim data yang anomali.
function useAnomaliConfirm() {
  const [state, setState] = useState(null); // { message, resolve }
  const [catatan, setCatatan] = useState('');

  function confirmAnomali(message) {
    setCatatan('');
    return new Promise(resolve => {
      setState({ message, resolve });
    });
  }
  function handle(result) {
    state.resolve(result);
    setState(null);
  }

  const catatanKosong = catatan.trim() === '';

  const modal = state ? (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', margin: 0 }}>
        <h2 style={{ color: 'var(--warn)' }}>⚠️ Anomali Terdeteksi</h2>
        <p style={{ whiteSpace: 'pre-line', fontSize: 14, marginBottom: 4 }}>{state.message}</p>
        <label>Catatan (wajib diisi kalau tetap kirim)</label>
        <textarea
          rows={3}
          value={catatan}
          onChange={e => setCatatan(e.target.value)}
          placeholder="Contoh: sudah dicek ulang, memang segini hasilnya karena..."
          style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button disabled={catatanKosong} onClick={() => handle({ confirmed: true, catatan: catatan.trim() })}>✅ Tetap Kirim</button>
        <button type="button" className="secondary" onClick={() => handle({ confirmed: false })}>✏️ Revisi Data</button>
      </div>
    </div>
  ) : null;

  return [modal, confirmAnomali];
}

function FormInner() {
  const params = useSearchParams();
  const router = useRouter();
  const target = params.get('target');
  const waktu = params.get('waktu') || '';
  const isRekap = target === 'rekap';
  const draftKey = `bk_draft_${target}_${waktu || 'x'}`;

  const [form, setForm] = useState({ tanggal: todayStr() });
  const [ph, setPh] = useState(emptyPh());
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [anomaliModal, confirmAnomali] = useAnomaliConfirm();
  const cooldown = useCooldown();
  const { modal: resultModal, showSuccess, showError } = useResultModal();

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function setPhField(line, key, value) {
    setPh(p => ({ ...p, [line]: { ...p[line], [key]: value } }));
  }

  // Simpan draft tiap kali form berubah — jaga-jaga HP/PC mati di tengah proses input.
  // Dibersihkan otomatis setelah submit berhasil (lihat clearDraft di bawah).
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ form, ph })); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, ph]);

  useEffect(() => {
    try { setHasDraft(!!localStorage.getItem(draftKey)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch {}
    setHasDraft(false);
  }

  function restoreDraft() {
    if (!confirm('Muat draft tersimpan? Ini akan menimpa data yang sedang Anda ketik di form ini.')) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.form) setForm(d.form);
      if (d.ph) setPh(d.ph);
    } catch {}
  }

  // Cek anomali EF WM shift SEBELUM kirim — dihitung sendiri di app (EF WM = Kg WM / Buka Kelapa)
  // sama seperti formula Excel. Hanya MENDETEKSI, tidak menampilkan dialog — dialog diatur di doSubmit().
  function deteksiAnomaliShift() {
    const bkKlpNum = parseFloat(form.bkKlp);
    const kgWmNum = parseFloat(form.kgWm);
    if (!isFinite(bkKlpNum) || !isFinite(kgWmNum) || bkKlpNum === 0) {
      return { anomali: false }; // data belum lengkap untuk dihitung — lanjut kirim seperti biasa
    }
    const efWm = kgWmNum / bkKlpNum;
    const isAnomali = efWm < RANGE_MIN || efWm > RANGE_MAX;
    if (!isAnomali) return { anomali: false };

    return {
      anomali: true,
      efWm,
      reason: `EF WM diperkirakan: ${toIDDecimal(efWm)}\nRange normal: ${toIDDecimal(RANGE_MIN)} - ${toIDDecimal(RANGE_MAX)}\n\nCek kembali Kg WM dan Buka Kelapa (Kg) — mungkin ada salah ketik.`
    };
  }

  // Cek anomali EF WM rekap — nilai EF WM rekap adalah akumulasi 3 shift yang SUDAH ada di Excel
  // (bukan dari isian form rekap ini), jadi diambil dari data live dashboard sebelum submit.
  async function deteksiAnomaliRekap() {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) return { anomali: false };
      const d = await res.json();
      const raw = d?.live?.rekap?.efWm;
      if (!raw || raw === '-') return { anomali: false };
      const efWm = parseFloat(String(raw).replace(',', '.'));
      if (!isFinite(efWm)) return { anomali: false };
      const isAnomali = efWm < RANGE_MIN || efWm > RANGE_MAX;
      if (!isAnomali) return { anomali: false };

      return {
        anomali: true,
        efWm,
        reason: `EF WM Rekap saat ini di Excel: ${toIDDecimal(efWm)}\nRange normal: ${toIDDecimal(RANGE_MIN)} - ${toIDDecimal(RANGE_MAX)}\n\nIni akumulasi dari 3 shift yang sudah masuk hari ini, bukan dari isian form Rekap ini.`
      };
    } catch {
      return { anomali: false }; // gagal cek → jangan blok submit
    }
  }

  async function doSubmit() {
    if (cooldown.remaining > 0) return;
    setMsg({ type: '', text: '' });

    const deteksi = isRekap ? await deteksiAnomaliRekap() : deteksiAnomaliShift();

    if (deteksi.anomali) {
      const pesan = `${deteksi.reason}\n\nAnda bisa:\n• Tetap Kirim — data akan dikirim ke Viewer untuk di-ACC dulu sebelum masuk Excel\n• Revisi Data — kembali mengecek isian form`;
      const konfirmasi = await confirmAnomali(pesan);
      if (!konfirmasi.confirmed) return; // Revisi — kembali ke form, tidak ada yang dikirim

      // Tetap Kirim → JANGAN langsung ke Excel/n8n, kirim dulu ke antrian approval Viewer/Superadmin
      setLoading(true);
      const payload = {
        ...form,
        tanggal: toExcelDate(form.tanggal),
        tanggalIso: form.tanggal
      };
      if (!isRekap) {
        payload.phSantan = phToPayload(ph);
      }

      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, waktu, form: payload, efWmPreview: deteksi.efWm, reason: deteksi.reason, catatan: konfirmasi.catatan })
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        if (data.cooldownRemainingSeconds) cooldown.start(data.cooldownRemainingSeconds);
        showError(data.error, doSubmit);
        return;
      }
      if (data.cooldownSeconds) cooldown.start(data.cooldownSeconds);
      let anomaliText = '📨 Data anomali terkirim ke Viewer untuk persetujuan. Excel belum diupdate sampai di-ACC.';
      anomaliText += data.waSent ? ' Notifikasi WA ke Viewer terkirim 📱' : ' (Notifikasi WA gagal terkirim, tapi tetap bisa dilihat Viewer di app)';
      clearDraft();
      showSuccess(anomaliText, () => router.push('/input'));
      return;
    }

    // Tidak anomali → kirim seperti biasa, langsung ke Excel + WA
    setLoading(true);

    const payload = {
      ...form,
      tanggal: toExcelDate(form.tanggal),
      tanggalIso: form.tanggal
    };

    if (!isRekap) {
      payload.phSantan = phToPayload(ph);
    }

    const url = isRekap ? '/api/rekap' : '/api/shift';
    const body = isRekap ? { form: payload } : { target, waktu, form: payload };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.cooldownRemainingSeconds) cooldown.start(data.cooldownRemainingSeconds);
      showError(data.error, doSubmit);
      return;
    }
    if (data.cooldownSeconds) cooldown.start(data.cooldownSeconds);
    let text = `${data.cellsWritten} cell tersimpan ke Excel.`;
    text += data.waSent ? ' Laporan WA sedang dikirim 📨' : ` ⚠️ ${data.warn || 'WA tidak terkirim'}`;
    clearDraft();
    showSuccess(text, () => router.push('/input'));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (cooldown.remaining > 0) return;

    const { valid, errors: newErrors } = validateProductionForm(isRekap, form, ph);
    setErrors(newErrors);
    if (!valid) {
      setMsg({ type: 'error', text: '⚠️ Data belum lengkap. Isi semua kolom yang ditandai merah (boleh isi 0 kalau memang tidak ada nilainya).' });
      return;
    }
    setMsg({ type: '', text: '' });
    doSubmit();
  }

  const title = isRekap
    ? '📋 Rekap Harian'
    : `${WAKTU_EMOJI[waktu] || ''} Shift ${(target || '').slice(-1)} (${waktu.toUpperCase()})`;

  if (!target) return <div className="container"><p>Target tidak valid</p></div>;

  return (
    <div className="container">
      <Nav />
      {anomaliModal}
      {resultModal}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h1>{title}</h1>
        {hasDraft && (
          <button type="button" className="secondary" style={{ width: 'auto', padding: '6px 14px', marginTop: 0 }} onClick={restoreDraft}>
            🔄 Refresh
          </button>
        )}
      </div>
      <p className="sub">Semua kolom wajib diisi (boleh 0 kalau memang tidak ada nilainya). Setelah simpan, laporan WA otomatis terkirim.</p>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <label>Tanggal *</label>
          <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} required />
        </div>

        <ProductionFormFields isRekap={isRekap} form={form} set={set} ph={ph} setPhField={setPhField} errors={errors} />

        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <CooldownNotice seconds={cooldown.remaining} />
        <button disabled={loading || cooldown.remaining > 0}>
          {loading ? 'Menyimpan & mengirim...' : '💾 Simpan & Kirim WA'}
        </button>
        <button type="button" className="secondary" onClick={() => router.push('/input')}>← Kembali</button>
      </form>
    </div>
  );
}

export default function InputFormPage() {
  return (
    <Suspense fallback={<div className="container">Memuat...</div>}>
      <FormInner />
    </Suspense>
  );
}
