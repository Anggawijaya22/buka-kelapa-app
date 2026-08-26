'use client';
import KgInput from '@/lib/KgInput';

const PH_LINES = ['A', 'B', 'C', 'D', 'E'];

export function emptyPh() {
  return Object.fromEntries(PH_LINES.map(l => [l, { dari: '', sampai: '', nilai: '' }]));
}

// "23:30" <-> "23.30" — format Excel pakai titik, input <input type=time> pakai titik dua
export function timeToDot(t) {
  return (t || '').replace(':', '.');
}
function dotToTime(t) {
  return (t || '').replace('.', ':');
}

// payload.phSantan (dari database) -> state form { A: {dari, sampai, nilai}, ... }
export function phFromPayload(phSantan) {
  const out = emptyPh();
  if (!phSantan) return out;
  for (const line of PH_LINES) {
    const entry = phSantan[line];
    if (!entry) continue;
    const [dariRaw, sampaiRaw] = (entry.jam || '').split(' - ');
    out[line] = { dari: dotToTime((dariRaw || '').trim()), sampai: dotToTime((sampaiRaw || '').trim()), nilai: entry.nilai || '' };
  }
  return out;
}

// state form ph -> bentuk payload.phSantan siap dikirim ke API
export function phToPayload(ph) {
  const out = {};
  for (const line of PH_LINES) {
    const p = ph[line];
    const jam = (p.dari && p.sampai) ? `${timeToDot(p.dari)} - ${timeToDot(p.sampai)}` : '';
    out[line] = { jam, nilai: p.nilai || '' };
  }
  return out;
}

// Field form Shift / Rekap — dipakai bersama oleh /input/form (input baru)
// dan /history (edit data lama), supaya definisi field selalu konsisten.
export default function ProductionFormFields({ isRekap, form, set, ph, setPhField }) {
  if (!isRekap) {
    return (
      <>
        <div className="card">
          <h2>Produksi</h2>
          <label>Buka Kelapa (Kg)</label>
          <KgInput value={form.bkKlp} onChange={v => set('bkKlp', v)} placeholder="contoh: 325676.3" />
          <label>Pakai Jambul (Kg)</label>
          <KgInput value={form.pakaiJmbl} onChange={v => set('pakaiJmbl', v)} placeholder="contoh: 266455" />
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
          <KgInput value={form.kgWm} onChange={v => set('kgWm', v)} placeholder="contoh: 114746.5" />
          <label>Air MP1 (Kg)</label>
          <KgInput value={form.airMp1} onChange={v => set('airMp1', v)} placeholder="contoh: 84676.06" />
          <label>Air MP2 (Kg)</label>
          <KgInput value={form.airMp2} onChange={v => set('airMp2', v)} placeholder="contoh: 1218.6" />
          <p className="sub" style={{ marginTop: 8 }}>EF WM, EF FCW, dan Total dihitung otomatis oleh formula Excel</p>
        </div>

        <div className="card">
          <h2>PH Santan</h2>
          <p className="sub">Pilih jam mulai & selesai (bisa diketik), lalu isi nilai PH dipisah garis miring</p>
          {['A', 'B', 'C', 'D', 'E'].map(line => (
            <div key={line} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <label>Line {line}</label>
              <div className="grid2">
                <div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Dari jam</span>
                  <input type="time" value={ph[line].dari} onChange={e => setPhField(line, 'dari', e.target.value)} />
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sampai jam</span>
                  <input type="time" value={ph[line].sampai} onChange={e => setPhField(line, 'sampai', e.target.value)} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nilai PH</span>
              <input type="text" value={ph[line].nilai} onChange={e => setPhField(line, 'nilai', e.target.value)} placeholder="6,05/6,08/6,06" />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="card">
        <h2>Stok</h2>
        <label>Stok di Petak (Kg)</label>
        <KgInput value={form.stokPetak} onChange={v => set('stokPetak', v)} />
        <label>Stok di Bufer (Kg)</label>
        <KgInput value={form.stokBufer} onChange={v => set('stokBufer', v)} />
        <p className="sub" style={{ marginTop: 8 }}>Total Stok dihitung otomatis oleh Excel</p>
      </div>

      <div className="card">
        <h2>Akumulasi</h2>
        <label>Akum BK KLP (Kg)</label>
        <KgInput value={form.akumBkKlp} onChange={v => set('akumBkKlp', v)} />
        <label>Akum Air MP1+MP2 (Kg)</label>
        <KgInput value={form.akumAir} onChange={v => set('akumAir', v)} />
        <label>EF FCW MP1+MP2</label>
        <input type="text" inputMode="decimal" value={form.efFcwMp12 || ''} onChange={e => set('efFcwMp12', e.target.value)} />
      </div>

      <div className="card">
        <h2>DC & Santan</h2>
        <label>DC (Kg)</label>
        <KgInput value={form.dc} onChange={v => set('dc', v)} />
        <label>Akum DC (Kg)</label>
        <KgInput value={form.akumDc} onChange={v => set('akumDc', v)} />
        <label>Santan L.A (Kg)</label>
        <KgInput value={form.santanLA} onChange={v => set('santanLA', v)} />
        <label>TTL Santan (Kg)</label>
        <KgInput value={form.ttlSantan} onChange={v => set('ttlSantan', v)} />
        <label>Akum Santan (Kg)</label>
        <KgInput value={form.akumSantan} onChange={v => set('akumSantan', v)} />
        <label>Sisa Kelapa</label>
        <input type="text" value={form.sisaKlp || ''} onChange={e => set('sisaKlp', e.target.value)} placeholder="contoh: 0" />
      </div>
    </>
  );
}
