'use client';
import { useState, useEffect } from 'react';
import Nav from '@/lib/Nav';
import ProductionFormFields, { emptyPh, phFromPayload, phToPayload, validateProductionForm } from '@/lib/ProductionFormFields';
import CooldownNotice from '@/lib/CooldownNotice';
import useCooldown from '@/lib/useCooldown';
import useResultModal from '@/lib/useResultModal';
import useConfirm from '@/lib/useConfirm';
import useAnomaliConfirm from '@/lib/useAnomaliConfirm';
import { detectShiftAnomali, detectRekapAnomali } from '@/lib/anomaliDetect';

const TARGET_LABELS = { shiftA: 'Shift A', shiftB: 'Shift B', shiftC: 'Shift C', rekap: '📋 Rekap Harian' };

const FIELD_LABELS_SHIFT = {
  bkKlp: 'Buka Kelapa (Kg)', pakaiJmbl: 'Pakai Jambul (Kg)', rijek: 'Rijek', sisaKlp: 'Sisa Kelapa',
  khdrnSh: 'Kehadiran Sheller', rt2Sh: 'Rata-rata Sheller', khdrnPr: 'Kehadiran Parer', rt2Pr: 'Rata-rata Parer',
  kgWm: 'Kg White Meat', airMp1: 'Air MP1 (Kg)', airMp2: 'Air MP2 (Kg)'
};
const FIELD_LABELS_REKAP = {
  stokPetak: 'Stok Petak (Kg)', stokBufer: 'Stok Bufer (Kg)', akumBkKlp: 'Akum BK KLP (Kg)', akumAir: 'Akum Air MP1+MP2 (Kg)',
  dc: 'DC (Kg)', akumDc: 'Akum DC (Kg)', santanLA: 'Santan L.A (Kg)',
  ttlSantan: 'TTL Santan (Kg)', akumSantan: 'Akum Santan (Kg)', sisaKlp: 'Sisa Kelapa'
};

const DEFAULT_MAX_SEND_COUNT = 3;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function waktuLabel(w) {
  return { pagi: '🌅 Pagi', siang: '☀️ Siang', malam: '🌙 Malam' }[w] || w || '';
}

function StatusBadge({ item, maxSendCount }) {
  if (item.status === 'draft') {
    return <span className="badge admin_atas">📝 Draft — belum dikirim</span>;
  }
  const count = item.send_count || 1;
  const locked = count >= maxSendCount;
  return (
    <span className={`badge ${locked ? 'superadmin' : 'admin'}`}>
      {locked ? '🔒' : '✅'} Terkirim {count}x{locked ? ' — terkunci' : ''}
    </span>
  );
}

function Ringkasan({ item }) {
  const isRekap = item.target === 'rekap';
  const labels = isRekap ? FIELD_LABELS_REKAP : FIELD_LABELS_SHIFT;
  const p = item.payload || {};
  const rows = Object.entries(labels).filter(([key]) => p[key] !== undefined && p[key] !== '');

  return (
    <table style={{ fontSize: 13 }}>
      <tbody>
        {!isRekap && p.waktu && (
          <tr><td style={{ color: 'var(--muted)', paddingRight: 12 }}>Waktu Shift</td><td>{waktuLabel(p.waktu)}</td></tr>
        )}
        {rows.map(([key, label]) => (
          <tr key={key}><td style={{ color: 'var(--muted)', paddingRight: 12 }}>{label}</td><td>{String(p[key])}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function EditForm({ item, cooldown, onSaved, onCancel }) {
  const isRekap = item.target === 'rekap';
  const isDraft = item.status === 'draft';
  const [form, setForm] = useState({ ...item.payload });
  const [ph, setPh] = useState(isRekap ? emptyPh() : phFromPayload(item.payload?.phSantan));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { modal: resultModal, showSuccess, showError } = useResultModal();
  const { modal: confirmModal, confirm: askKirimConfirm } = useConfirm();
  const [anomaliModal, confirmAnomali] = useAnomaliConfirm();

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }
  function setPhField(line, key, value) { setPh(p => ({ ...p, [line]: { ...p[line], [key]: value } })); }

  function buildPayload() {
    const payload = { ...form };
    if (!isRekap) payload.phSantan = phToPayload(ph);
    return payload;
  }

  async function doSave(send) {
    if (send && cooldown.remaining > 0) return;
    send ? setSaving(true) : setSavingDraft(true);
    setMsg({ type: '', text: '' });

    const res = await fetch('/api/monitoring', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, form: buildPayload(), send })
    });
    const data = await res.json();
    setSaving(false);
    setSavingDraft(false);

    if (!res.ok) {
      if (data.cooldownRemainingSeconds) cooldown.start(data.cooldownRemainingSeconds);
      showError(data.error, () => doSave(send));
      return;
    }
    if (data.cooldownSeconds) cooldown.start(data.cooldownSeconds);

    if (!send) {
      showSuccess('Perubahan draft tersimpan — masih belum dikirim ke Excel/WA.', () => onSaved?.());
      return;
    }
    let text = data.wroteToExcel
      ? `Perubahan tersimpan & ${data.cellsWritten} cell diupdate ke Excel.`
      : 'Perubahan tersimpan ke riwayat. Tanggal ini bukan hari ini, jadi Excel (laporan live) tidak disentuh.';
    text += data.waSent ? ' Notifikasi WA terkirim 📨' : ` ⚠️ ${data.warn || 'WA tidak terkirim'}`;
    showSuccess(text, () => onSaved?.());
  }

  // Data anomali yang tetap dikirim TIDAK boleh langsung ke Excel/WA — harus lewat antrian
  // approval Viewer/Developer dulu, persis seperti submit baru dari Input Data. Bedanya di sini
  // approval-nya menunjuk ke record submissions yang sudah ada (submissionId), jadi begitu
  // di-ACC nanti, hasilnya MENIMPA record yang sama, bukan bikin baris baru.
  async function kirimKeApproval(payload, deteksi, catatan) {
    setSaving(true);
    setMsg({ type: '', text: '' });

    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: item.target,
        waktu: item.payload?.waktu,
        form: payload,
        efWmPreview: deteksi.efWm,
        reason: deteksi.reason,
        catatan,
        submissionId: item.id
      })
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      if (data.cooldownRemainingSeconds) cooldown.start(data.cooldownRemainingSeconds);
      showError(data.error, () => kirimKeApproval(payload, deteksi, catatan));
      return;
    }
    if (data.cooldownSeconds) cooldown.start(data.cooldownSeconds);
    let text = 'Data anomali terkirim ke Viewer untuk persetujuan. Excel belum diupdate sampai di-ACC.';
    text += data.waSent ? ' Notifikasi WA ke Viewer terkirim 📱' : ' (Notifikasi WA gagal terkirim, tapi tetap bisa dilihat Viewer di app)';
    showSuccess(text, () => onSaved?.());
  }

  function validateThenRun(run) {
    const { valid, errors: newErrors } = validateProductionForm(isRekap, form, ph);
    setErrors(newErrors);
    if (!valid) {
      setMsg({ type: 'error', text: '⚠️ Data belum lengkap. Isi semua kolom yang ditandai merah (boleh isi 0 kalau memang tidak ada nilainya).' });
      return;
    }
    setMsg({ type: '', text: '' });
    run();
  }

  function simpanDraft() {
    validateThenRun(() => doSave(false));
  }

  // Dipakai baik oleh "Kirim Data" (draft) maupun "Simpan Perubahan" (record yang sudah pernah
  // dikirim) — keduanya sama-sama harus dicek anomali dulu sebelum benar-benar kirim ke Excel/WA.
  function kirimAtauKirimUlang() {
    if (cooldown.remaining > 0) return;
    validateThenRun(async () => {
      const payload = buildPayload();
      const deteksi = isRekap ? await detectRekapAnomali() : detectShiftAnomali(payload);

      if (deteksi.anomali) {
        const pesan = `${deteksi.reason}\n\nAnda bisa:\n• Tetap Kirim — data akan dikirim ke Viewer untuk di-ACC dulu sebelum masuk Excel\n• Revisi Data — kembali mengecek isian form`;
        const konfirmasi = await confirmAnomali(pesan);
        if (!konfirmasi.confirmed) return; // Revisi — kembali ke form, tidak ada yang dikirim
        await kirimKeApproval(payload, deteksi, konfirmasi.catatan);
        return;
      }

      const yakin = await askKirimConfirm('Yakin kirim data?');
      if (!yakin) return;
      doSave(true);
    });
  }

  return (
    <div>
      {anomaliModal}
      {resultModal}
      {confirmModal}
      <ProductionFormFields isRekap={isRekap} form={form} set={set} ph={ph} setPhField={setPhField} errors={errors} />
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <CooldownNotice seconds={cooldown.remaining} />
      {isDraft ? (
        <>
          <button type="button" className="secondary" disabled={savingDraft} onClick={simpanDraft}>
            {savingDraft ? 'Menyimpan...' : '💾 Simpan'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>Batal</button>
          <button type="button" disabled={saving || cooldown.remaining > 0} onClick={kirimAtauKirimUlang}>
            {saving ? 'Mengirim...' : '📤 Kirim Data'}
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={saving || cooldown.remaining > 0} onClick={kirimAtauKirimUlang}>
            {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>Batal</button>
        </>
      )}
    </div>
  );
}

function Section({ item, cooldown, isSuper, maxSendCount, onChanged }) {
  const [editing, setEditing] = useState(false);
  const label = TARGET_LABELS[item.target] || item.target;

  if (!item.id) {
    return (
      <div className="card">
        <h2>{label}</h2>
        <p className="sub">Belum ada data untuk tanggal ini.</p>
      </div>
    );
  }

  const locked = item.status === 'sent' && (item.send_count || 1) >= maxSendCount && !isSuper;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ marginBottom: 0 }}>{label}</h2>
        <StatusBadge item={item} maxSendCount={maxSendCount} />
        {!editing && !locked && (
          <button type="button" className="secondary" style={{ width: 'auto', padding: '6px 14px', marginTop: 0 }} onClick={() => setEditing(true)}>
            ✏️ Edit
          </button>
        )}
      </div>
      <p className="sub" style={{ marginTop: 8 }}>
        {item.status === 'draft' ? 'Disimpan' : 'Dikirim'} {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} oleh {item.username || '-'}
        {item.edited_at && ` · diedit terakhir ${new Date(item.edited_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} oleh ${item.edited_by_username || '-'}`}
      </p>
      {locked && (
        <p className="error" style={{ marginBottom: 12 }}>
          🔒 Data ini sudah dikirim {maxSendCount}x dan terkunci untuk revisi lebih lanjut. Hubungi Developer,
          atau input ulang dari menu Input Data kalau memang perlu koreksi.
        </p>
      )}
      {editing ? (
        <EditForm
          item={item}
          cooldown={cooldown}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged(); }}
        />
      ) : (
        <Ringkasan item={item} />
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const [role, setRole] = useState('');
  const [tanggal, setTanggal] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [maxSendCount, setMaxSendCount] = useState(DEFAULT_MAX_SEND_COUNT);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const cooldown = useCooldown();

  useEffect(() => {
    setRole(sessionStorage.getItem('bk_role') || '');
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/monitoring?tanggal=${tanggal}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const d = await res.json();
    setItems(d.items || []);
    if (d.maxSendCount) setMaxSendCount(d.maxSendCount);
    setLoading(false);
  }

  if (forbidden) {
    return (
      <div className="container">
        <Nav />
        <div className="card"><p className="error">Anda tidak punya akses ke halaman ini</p></div>
      </div>
    );
  }

  const isSuper = role === 'superadmin';

  return (
    <div className="container">
      <Nav />
      <h1>Monitoring</h1>
      <p className="sub">
        {role === 'admin'
          ? 'Riwayat data shift Anda — bisa dicek dan diedit'
          : 'Pantau & edit data Shift A/B/C serta Rekap Harian'}
      </p>

      <div className="card">
        <label>Tanggal</label>
        <input type="date" value={tanggal} max={todayStr()} onChange={e => setTanggal(e.target.value)} />
      </div>

      {loading && <p>Memuat...</p>}
      {!loading && items.map(item => (
        <Section key={item.target} item={item} cooldown={cooldown} isSuper={isSuper} maxSendCount={maxSendCount} onChanged={load} />
      ))}
    </div>
  );
}
