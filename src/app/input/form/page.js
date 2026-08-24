'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';

const WAKTU_EMOJI = { pagi: '🌅', siang: '☀️', malam: '🌙' };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function toExcelDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
// "23:30" → "23.30"
function timeToDot(t) {
  return (t || '').replace(':', '.');
}

// Komponen input jam 24 jam — dropdown HH + MM, tidak bergantung locale sistem
// value format: "HH:MM" atau ""
function TimeInput({ value, onChange }) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const [hh, mm] = value && value.includes(':') ? value.split(':') : ['', ''];

  function handleH(e) {
    const h = e.target.value;
    onChange(h ? `${h}:${mm || '00'}` : '');
  }
  function handleM(e) {
    const m = e.target.value;
    onChange(hh ? `${hh}:${m}` : '');
  }
  // Ketik manual dengan auto-masking: "2022" → "20:22", "20:22" tetap "20:22"
  function handleManual(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length === 0) { onChange(''); return; }
    if (digits.length <= 2) { onChange(digits); return; }
    const masked = digits.slice(0, 2) + ':' + digits.slice(2);
    onChange(masked);
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select
        value={hh}
        onChange={handleH}
        style={{ width: 64, padding: '10px 6px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 15 }}
      >
        <option value="">Jam</option>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ fontWeight: 700, fontSize: 16 }}>:</span>
      <select
        value={mm}
        onChange={handleM}
        style={{ width: 64, padding: '10px 6px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 15 }}
      >
        <option value="">Mnt</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <input
        type="text"
        value={value}
        onChange={handleManual}
        placeholder="14:30"
        maxLength={5}
        inputMode="numeric"
        style={{ width: 70, padding: '10px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 15 }}
      />
    </div>
  );
}

function FormInner() {
  const params = useSearchParams();
  const router = useRouter();
  const target = params.get('target');
  const waktu = params.get('waktu') || '';
  const isRekap = target === 'rekap';

  const [form, setForm] = useState({ tanggal: todayStr() });
  const [ph, setPh] = useState({
    A: { dari: '', sampai: '', nilai: '' },
    B: { dari: '', sampai: '', nilai: '' },
    C: { dari: '', sampai: '', nilai: '' },
    D: { dari: '', sampai: '', nilai: '' },
    E: { dari: '', sampai: '', nilai: '' }
  });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function setPhField(line, key, value) {
    setPh(p => ({ ...p, [line]: { ...p[line], [key]: value } }));
  }

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setLoading(true);

    const payload = {
      ...form,
      tanggal: toExcelDate(form.tanggal),
      tanggalIso: form.tanggal
    };

    if (!isRekap) {
      // Susun PH Santan: jam = "23.30 - 04.30"
      const phOut = {};
      for (const line of ['A', 'B', 'C', 'D', 'E']) {
        const p = ph[line];
        const jam = (p.dari && p.sampai) ? `${timeToDot(p.dari)} - ${timeToDot(p.sampai)}` : '';
        phOut[line] = { jam, nilai: p.nilai || '' };
      }
      payload.phSantan = phOut;
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
      setMsg({ type: 'error', text: data.error });
      return;
    }
    let text = `✅ ${data.cellsWritten} cell tersimpan ke Excel.`;
    text += data.waSent ? ' Laporan WA sedang dikirim 📨' : ` ⚠️ ${data.warn || 'WA tidak terkirim'}`;
    setMsg({ type: data.waSent ? 'success' : 'error', text });
  }

  const title = isRekap
    ? '📋 Rekap Harian'
    : `${WAKTU_EMOJI[waktu] || ''} Shift ${(target || '').slice(-1)} (${waktu.toUpperCase()})`;

  if (!target) return <div className="container"><p>Target tidak valid</p></div>;

  return (
    <div className="container">
      <Nav />
      <h1>{title}</h1>
      <p className="sub">Field kosong tidak akan menimpa isi Excel. Setelah simpan, laporan WA otomatis terkirim.</p>

      <form onSubmit={submit}>
        <div className="card">
          <label>Tanggal *</label>
          <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} required />
        </div>

        {!isRekap && (
          <>
            <div className="card">
              <h2>Produksi</h2>
              <label>Buka Kelapa (Kg)</label>
              <input type="text" inputMode="decimal" value={form.bkKlp || ''} onChange={e => set('bkKlp', e.target.value)} placeholder="contoh: 325676.3" />
              <label>Pakai Jambul (Kg)</label>
              <input type="text" inputMode="decimal" value={form.pakaiJmbl || ''} onChange={e => set('pakaiJmbl', e.target.value)} placeholder="contoh: 266455" />
              <label>Rijek (desimal, contoh 0.0156 = 1,56%)</label>
              <input type="text" inputMode="decimal" value={form.rijek || ''} onChange={e => set('rijek', e.target.value)} placeholder="contoh: 0.0156" />
              <label>Sisa Kelapa</label>
              <input type="text" value={form.sisaKlp || ''} onChange={e => set('sisaKlp', e.target.value)} placeholder="contoh: 0 Tank" />
            </div>

            <div className="card">
              <h2>Kehadiran Sheller</h2>
              <label>Format: B136,H0,L0=136dr154=88,31%</label>
              <input type="text" value={form.khdrnSh || ''} onChange={e => set('khdrnSh', e.target.value)} placeholder="B136,H0,L0=136dr154=88,31%" />
              <label>Rata-rata Sheller</label>
              <input type="text" value={form.rt2Sh || ''} onChange={e => set('rt2Sh', e.target.value)} placeholder="B2395,H0,L0= Rata 2395" />
            </div>

            <div className="card">
              <h2>Kehadiran Parer</h2>
              <label>Format: B358,H13,L0=371dr408=90,93%</label>
              <input type="text" value={form.khdrnPr || ''} onChange={e => set('khdrnPr', e.target.value)} placeholder="B358,H13,L0=371dr408=90,93%" />
              <label>Rata-rata Parer</label>
              <input type="text" value={form.rt2Pr || ''} onChange={e => set('rt2Pr', e.target.value)} placeholder="B845,H0,L0=Rata 845" />
            </div>

            <div className="card">
              <h2>White Meat & Air</h2>
              <label>Kg White Meat</label>
              <input type="text" inputMode="decimal" value={form.kgWm || ''} onChange={e => set('kgWm', e.target.value)} placeholder="contoh: 114746.5" />
              <label>Air MP1 (Kg)</label>
              <input type="text" inputMode="decimal" value={form.airMp1 || ''} onChange={e => set('airMp1', e.target.value)} placeholder="contoh: 84676.06" />
              <label>Air MP2 (Kg)</label>
              <input type="text" inputMode="decimal" value={form.airMp2 || ''} onChange={e => set('airMp2', e.target.value)} placeholder="contoh: 1218.6" />
              <p className="sub" style={{ marginTop: 8 }}>EF WM, EF FCW, dan Total dihitung otomatis oleh formula Excel</p>
            </div>

            <div className="card">
              <h2>PH Santan</h2>
              <p className="sub">Ketik jam format 24 jam (cth: 14:30), lalu isi nilai PH dipisah garis miring</p>
              {['A', 'B', 'C', 'D', 'E'].map(line => (
                <div key={line} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <label>Line {line}</label>
                  <div className="grid2">
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Dari jam</span>
                      <TimeInput value={ph[line].dari} onChange={v => setPhField(line, 'dari', v)} />
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sampai jam</span>
                      <TimeInput value={ph[line].sampai} onChange={v => setPhField(line, 'sampai', v)} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nilai PH</span>
                  <input type="text" value={ph[line].nilai} onChange={e => setPhField(line, 'nilai', e.target.value)} placeholder="6,05/6,08/6,06" />
                </div>
              ))}
            </div>
          </>
        )}

        {isRekap && (
          <>
            <div className="card">
              <h2>Stok</h2>
              <label>Stok di Petak (Kg)</label>
              <input type="text" inputMode="decimal" value={form.stokPetak || ''} onChange={e => set('stokPetak', e.target.value)} />
              <label>Stok di Bufer (Kg)</label>
              <input type="text" inputMode="decimal" value={form.stokBufer || ''} onChange={e => set('stokBufer', e.target.value)} />
              <p className="sub" style={{ marginTop: 8 }}>Total Stok dihitung otomatis oleh Excel</p>
            </div>

            <div className="card">
              <h2>Akumulasi</h2>
              <label>Akum BK KLP (Kg)</label>
              <input type="text" inputMode="decimal" value={form.akumBkKlp || ''} onChange={e => set('akumBkKlp', e.target.value)} />
              <label>Akum Air MP1+MP2 (Kg)</label>
              <input type="text" inputMode="decimal" value={form.akumAir || ''} onChange={e => set('akumAir', e.target.value)} />
              <label>EF FCW MP1+MP2</label>
              <input type="text" inputMode="decimal" value={form.efFcwMp12 || ''} onChange={e => set('efFcwMp12', e.target.value)} />
            </div>

            <div className="card">
              <h2>DC & Santan</h2>
              <label>DC (Kg)</label>
              <input type="text" inputMode="decimal" value={form.dc || ''} onChange={e => set('dc', e.target.value)} />
              <label>Akum DC (Kg)</label>
              <input type="text" inputMode="decimal" value={form.akumDc || ''} onChange={e => set('akumDc', e.target.value)} />
              <label>Santan L.A (Kg)</label>
              <input type="text" inputMode="decimal" value={form.santanLA || ''} onChange={e => set('santanLA', e.target.value)} />
              <label>TTL Santan (Kg)</label>
              <input type="text" inputMode="decimal" value={form.ttlSantan || ''} onChange={e => set('ttlSantan', e.target.value)} />
              <label>Akum Santan (Kg)</label>
              <input type="text" inputMode="decimal" value={form.akumSantan || ''} onChange={e => set('akumSantan', e.target.value)} />
              <label>Sisa Kelapa</label>
              <input type="text" value={form.sisaKlp || ''} onChange={e => set('sisaKlp', e.target.value)} placeholder="contoh: 0" />
            </div>
          </>
        )}

        {msg.text && <p className={msg.type}>{msg.text}</p>}
        <button disabled={loading}>{loading ? 'Menyimpan & mengirim...' : '💾 Simpan & Kirim WA'}</button>
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
