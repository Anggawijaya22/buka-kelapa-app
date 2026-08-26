'use client';
import { useState, useEffect } from 'react';
import Nav from '@/lib/Nav';
import ProductionFormFields, { emptyPh, phFromPayload, phToPayload, validateProductionForm } from '@/lib/ProductionFormFields';
import CooldownNotice from '@/lib/CooldownNotice';
import useCooldown from '@/lib/useCooldown';
import useResultModal from '@/lib/useResultModal';

const TARGET_LABELS = { shiftA: 'Shift A', shiftB: 'Shift B', shiftC: 'Shift C', rekap: '📋 Rekap Harian' };

const FIELD_LABELS_SHIFT = {
  bkKlp: 'Buka Kelapa (Kg)', pakaiJmbl: 'Pakai Jambul (Kg)', rijek: 'Rijek', sisaKlp: 'Sisa Kelapa',
  khdrnSh: 'Kehadiran Sheller', rt2Sh: 'Rata-rata Sheller', khdrnPr: 'Kehadiran Parer', rt2Pr: 'Rata-rata Parer',
  kgWm: 'Kg White Meat', airMp1: 'Air MP1 (Kg)', airMp2: 'Air MP2 (Kg)'
};
const FIELD_LABELS_REKAP = {
  stokPetak: 'Stok Petak (Kg)', stokBufer: 'Stok Bufer (Kg)', akumBkKlp: 'Akum BK KLP (Kg)', akumAir: 'Akum Air MP1+MP2 (Kg)',
  efFcwMp12: 'EF FCW MP1+MP2', dc: 'DC (Kg)', akumDc: 'Akum DC (Kg)', santanLA: 'Santan L.A (Kg)',
  ttlSantan: 'TTL Santan (Kg)', akumSantan: 'Akum Santan (Kg)', sisaKlp: 'Sisa Kelapa'
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function waktuLabel(w) {
  return { pagi: '🌅 Pagi', siang: '☀️ Siang', malam: '🌙 Malam' }[w] || w || '';
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
  const [form, setForm] = useState({ ...item.payload });
  const [ph, setPh] = useState(isRekap ? emptyPh() : phFromPayload(item.payload?.phSantan));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { modal: resultModal, showSuccess, showError } = useResultModal();

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }
  function setPhField(line, key, value) { setPh(p => ({ ...p, [line]: { ...p[line], [key]: value } })); }

  async function doSave() {
    if (cooldown.remaining > 0) return;
    setSaving(true);
    setMsg({ type: '', text: '' });

    const payload = { ...form };
    if (!isRekap) payload.phSantan = phToPayload(ph);

    const res = await fetch('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, form: payload })
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      if (data.cooldownRemainingSeconds) cooldown.start(data.cooldownRemainingSeconds);
      showError(data.error, doSave);
      return;
    }
    if (data.cooldownSeconds) cooldown.start(data.cooldownSeconds);

    let text = data.wroteToExcel
      ? `Perubahan tersimpan & ${data.cellsWritten} cell diupdate ke Excel.`
      : 'Perubahan tersimpan ke riwayat. Tanggal ini bukan hari ini, jadi Excel (laporan live) tidak disentuh.';
    text += data.waSent ? ' Notifikasi WA terkirim 📨' : ` ⚠️ ${data.warn || 'WA tidak terkirim'}`;
    showSuccess(text, () => onSaved?.());
  }

  function save() {
    if (cooldown.remaining > 0) return;
    const { valid, errors: newErrors } = validateProductionForm(isRekap, form, ph);
    setErrors(newErrors);
    if (!valid) {
      setMsg({ type: 'error', text: '⚠️ Data belum lengkap. Isi semua kolom yang ditandai merah (boleh isi 0 kalau memang tidak ada nilainya).' });
      return;
    }
    setMsg({ type: '', text: '' });
    doSave();
  }

  return (
    <div>
      {resultModal}
      <ProductionFormFields isRekap={isRekap} form={form} set={set} ph={ph} setPhField={setPhField} errors={errors} />
      {msg.text && <p className={msg.type}>{msg.text}</p>}
      <CooldownNotice seconds={cooldown.remaining} />
      <button type="button" disabled={saving || cooldown.remaining > 0} onClick={save}>
        {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
      </button>
      <button type="button" className="secondary" onClick={onCancel}>Batal</button>
    </div>
  );
}

function Section({ item, cooldown, onChanged }) {
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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{label}</h2>
        {!editing && (
          <button type="button" className="secondary" style={{ width: 'auto', padding: '6px 14px', marginTop: 0 }} onClick={() => setEditing(true)}>
            ✏️ Edit
          </button>
        )}
      </div>
      <p className="sub">
        Dikirim {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} oleh {item.username || '-'}
        {item.edited_at && ` · diedit terakhir ${new Date(item.edited_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} oleh ${item.edited_by_username || '-'}`}
      </p>
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

export default function HistoryPage() {
  const [role, setRole] = useState('');
  const [tanggal, setTanggal] = useState(todayStr());
  const [items, setItems] = useState([]);
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
    const res = await fetch(`/api/history?tanggal=${tanggal}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const d = await res.json();
    setItems(d.items || []);
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

  return (
    <div className="container">
      <Nav />
      <h1>History</h1>
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
        <Section key={item.target} item={item} cooldown={cooldown} onChanged={load} />
      ))}
    </div>
  );
}
