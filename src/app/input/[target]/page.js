'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';

const LABELS = {
  shiftA: '☀️ Shift A (Siang)',
  shiftB: '🌙 Shift B (Malam)',
  shiftC: '🌅 Shift C (Pagi)',
  rekap: '📋 Rekap Harian'
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Konversi yyyy-mm-dd → dd/mm/yy untuk Excel
function toExcelDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export default function InputFormPage() {
  const { target } = useParams();
  const router = useRouter();
  const isRekap = target === 'rekap';

  const [form, setForm] = useState({ tanggal: todayStr() });
  const [ph, setPh] = useState({ A: {}, B: {}, C: {}, D: {}, E: {} });
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

    const payload = { ...form, tanggal: toExcelDate(form.tanggal) };
    if (!isRekap) payload.phSantan = ph;

    const url = isRekap ? '/api/rekap' : '/api/shift';
    const body = isRekap ? { form: payload } : { target, form: payload };

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
    setMsg({ type: 'success', text: `✅ Berhasil! ${data.cellsWritten} cell tersimpan ke Excel.` });
  }

  if (!LABELS[target]) return <div className="container"><p>Target tidak valid</p></div>;

  return (
    <div className="container">
      <Nav />
      <h1>{LABELS[target]}</h1>
      <p className="sub">Field kosong tidak akan menimpa isi Excel</p>

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
              <label>Rata-rata Sheller (contoh: B2395,H0,L0= Rata 2395)</label>
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
              {['A', 'B', 'C', 'D', 'E'].map(line => (
                <div key={line} style={{ marginBottom: 12 }}>
                  <label>Line {line}</label>
                  <div className="grid2">
                    <input type="text" value={ph[line].jam || ''} onChange={e => setPhField(line, 'jam', e.target.value)} placeholder="15.30 - 20.30" />
                    <input type="text" value={ph[line].nilai || ''} onChange={e => setPhField(line, 'nilai', e.target.value)} placeholder="6,05/6,08/6,06" />
                  </div>
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
        <button disabled={loading}>{loading ? 'Menyimpan ke Excel...' : '💾 Simpan ke Excel'}</button>
        <button type="button" className="secondary" onClick={() => router.push('/input')}>← Kembali</button>
      </form>
    </div>
  );
}
