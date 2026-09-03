'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';
import ProductionFormFields, { emptyPh, phToPayload, validateProductionForm } from '@/lib/ProductionFormFields';
import CooldownNotice from '@/lib/CooldownNotice';
import useCooldown from '@/lib/useCooldown';
import useResultModal from '@/lib/useResultModal';
import useConfirm from '@/lib/useConfirm';
import useAnomaliConfirm from '@/lib/useAnomaliConfirm';
import { detectShiftAnomali, detectRekapAnomali } from '@/lib/anomaliDetect';
import { formatIsoDisplay } from '@/lib/dateDisplay';
import { IconSunrise, IconSun, IconMoon, IconFileText, IconRefreshCw, IconCalendar, IconAlertTriangle, IconSave, IconSend } from '@/lib/icons';

const WAKTU_ICON = { pagi: IconSunrise, siang: IconSun, malam: IconMoon };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function toExcelDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
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
  const { modal: confirmModal, confirm: askKirimConfirm } = useConfirm();
  const [savingDraft, setSavingDraft] = useState(false);

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

  function buildPayload() {
    const payload = {
      ...form,
      tanggal: toExcelDate(form.tanggal),
      tanggalIso: form.tanggal
    };
    if (!isRekap) payload.phSantan = phToPayload(ph);
    return payload;
  }

  // Tombol "Simpan" — cuma masuk ke Monitoring (Supabase), TIDAK ke Excel/webhook sama sekali.
  // Tidak ada deteksi anomali (tidak relevan, karena tidak ada notifikasi WA yang dikirim).
  async function doSimpan() {
    setSavingDraft(true);
    setMsg({ type: '', text: '' });

    const url = isRekap ? '/api/rekap' : '/api/shift';
    const body = isRekap ? { form: buildPayload(), mode: 'draft' } : { target, waktu, form: buildPayload(), mode: 'draft' };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setSavingDraft(false);

    if (!res.ok) {
      showError(data.error, doSimpan);
      return;
    }
    clearDraft();
    showSuccess('Data tersimpan sebagai draft di menu Monitoring — belum dikirim ke Excel/WA. Bisa dicek, diedit, atau dikirim kapan saja dari sana.', () => router.push('/input'));
  }

  function handleSimpan(e) {
    e.preventDefault();
    const { valid, errors: newErrors } = validateProductionForm(isRekap, form, ph);
    setErrors(newErrors);
    if (!valid) {
      setMsg({ type: 'error', text: 'Data belum lengkap. Isi semua kolom yang ditandai merah (boleh isi 0 kalau memang tidak ada nilainya).' });
      return;
    }
    setMsg({ type: '', text: '' });
    doSimpan();
  }

  async function doSubmit() {
    if (cooldown.remaining > 0) return;
    setMsg({ type: '', text: '' });

    const deteksi = isRekap ? await detectRekapAnomali() : detectShiftAnomali(form);

    if (deteksi.anomali) {
      const pesan = `${deteksi.reason}\n\nAnda bisa:\n• Tetap Kirim — data akan dikirim ke Viewer untuk di-ACC dulu sebelum masuk Excel\n• Revisi Data — kembali mengecek isian form`;
      const konfirmasi = await confirmAnomali(pesan);
      if (!konfirmasi.confirmed) return; // Revisi — kembali ke form, tidak ada yang dikirim

      // Tetap Kirim → JANGAN langsung ke Excel/n8n, kirim dulu ke antrian approval Viewer/Superadmin
      setLoading(true);
      const payload = buildPayload();

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
      let anomaliText = 'Data anomali terkirim ke Viewer untuk persetujuan. Excel belum diupdate sampai di-ACC.';
      anomaliText += data.waSent ? ' Notifikasi WA ke Viewer terkirim.' : ' (Notifikasi WA gagal terkirim, tapi tetap bisa dilihat Viewer di app)';
      clearDraft();
      showSuccess(anomaliText, () => router.push('/input'));
      return;
    }

    // Tidak anomali → minta konfirmasi dulu, baru kirim langsung ke Excel + WA
    const yakin = await askKirimConfirm('Yakin kirim data?');
    if (!yakin) return; // Batal — kembali ke form, data isian tetap ada

    setLoading(true);
    const payload = buildPayload();

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
    text += data.waSent ? ' Laporan WA sedang dikirim.' : ` Catatan: ${data.warn || 'WA tidak terkirim'}`;
    clearDraft();
    showSuccess(text, () => router.push('/input'));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (cooldown.remaining > 0) return;

    const { valid, errors: newErrors } = validateProductionForm(isRekap, form, ph);
    setErrors(newErrors);
    if (!valid) {
      setMsg({ type: 'error', text: 'Data belum lengkap. Isi semua kolom yang ditandai merah (boleh isi 0 kalau memang tidak ada nilainya).' });
      return;
    }
    setMsg({ type: '', text: '' });
    doSubmit();
  }

  const TitleIcon = isRekap ? IconFileText : (WAKTU_ICON[waktu] || null);
  const titleText = isRekap
    ? 'Rekap Harian'
    : `Shift ${(target || '').slice(-1)} (${waktu.toUpperCase()})`;

  if (!target) return <div className="container"><p>Target tidak valid</p></div>;

  return (
    <div className="container">
      <Nav />
      {anomaliModal}
      {resultModal}
      {confirmModal}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h1>{TitleIcon && <TitleIcon size={22} style={{ marginRight: 8 }} />}{titleText}</h1>
        {hasDraft && (
          <button type="button" className="secondary" style={{ width: 'auto', padding: '6px 14px', marginTop: 0 }} onClick={restoreDraft}>
            <IconRefreshCw size={14} style={{ marginRight: 6 }} />Refresh
          </button>
        )}
      </div>
      <p className="sub">
        Semua kolom wajib diisi (boleh 0 kalau memang tidak ada nilainya). "Simpan" hanya masuk ke
        Monitoring (belum ke Excel/WA); "Kirim Data" langsung kirim ke Excel & WA.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <label>Tanggal *</label>
          <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} required />
          {/* Widget kalender bawaan browser ikut locale device (bisa tampil mm/dd/yyyy di HP
              ber-bahasa Inggris) — label ini penegas format Indonesia yang sebenarnya tersimpan. */}
          <small style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: 'var(--muted, #666)' }}>
            <IconCalendar size={14} />{formatIsoDisplay(form.tanggal)} (format Indonesia: DD/MM/YYYY)
          </small>
        </div>

        <ProductionFormFields isRekap={isRekap} form={form} set={set} ph={ph} setPhField={setPhField} errors={errors} />

        {msg.text && (
          <p className={msg.type}>
            {msg.type === 'error' && <IconAlertTriangle size={14} style={{ marginRight: 6 }} />}
            {msg.text}
          </p>
        )}
        <CooldownNotice seconds={cooldown.remaining} />
        <button type="button" className="secondary" disabled={savingDraft} onClick={handleSimpan}>
          {savingDraft ? 'Menyimpan...' : (<><IconSave size={16} style={{ marginRight: 6 }} />Simpan</>)}
        </button>
        <button type="button" className="secondary" onClick={() => router.push('/input')}>← Kembali</button>
        <button disabled={loading || cooldown.remaining > 0}>
          {loading ? 'Mengirim...' : (<><IconSend size={16} style={{ marginRight: 6 }} />Kirim Data</>)}
        </button>
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
