'use client';
import KgInput from '@/lib/KgInput';
import { IconAlertTriangle } from '@/lib/icons';

const PH_LINES = ['A', 'B', 'C', 'D', 'E'];

export const SHIFT_FIELD_KEYS = ['bkKlp', 'pakaiJmbl', 'rijek', 'sisaKlp', 'khdrnSh', 'rt2Sh', 'khdrnPr', 'rt2Pr', 'kgWm', 'airMp1', 'airMp2'];
export const REKAP_FIELD_KEYS = ['stokPetak', 'stokBufer', 'akumBkKlp', 'akumAir', 'dc', 'akumDc', 'santanLA', 'ttlSantan', 'akumSantan', 'sisaKlp'];

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

function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

// Semua field wajib diisi (boleh 0 kalau memang tidak ada nilainya) — mencegah kolom
// ke-skip tanpa sadar. Mengembalikan { valid, errors: { fieldKey: true, ph_A_dari: true, ... } }.
export function validateProductionForm(isRekap, form, ph) {
  const keys = isRekap ? REKAP_FIELD_KEYS : SHIFT_FIELD_KEYS;
  const errors = {};
  for (const key of keys) {
    if (isEmpty(form[key])) errors[key] = true;
  }
  if (!isRekap) {
    for (const line of PH_LINES) {
      const p = ph[line] || {};
      if (isEmpty(p.dari)) errors[`ph_${line}_dari`] = true;
      if (isEmpty(p.sampai)) errors[`ph_${line}_sampai`] = true;
      if (isEmpty(p.nilai)) errors[`ph_${line}_nilai`] = true;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function errClass(key, errors) {
  return errors && errors[key] ? 'field-error' : '';
}

function ErrMark({ show }) {
  return show ? <IconAlertTriangle size={13} style={{ color: '#dc2626', marginLeft: 4 }} /> : null;
}

// Field form Shift / Rekap — dipakai bersama oleh /input/form (input baru)
// dan /history (edit data lama), supaya definisi field selalu konsisten.
// `errors` (opsional): hasil dari validateProductionForm — kalau ada, field yang error ditandai merah.
export default function ProductionFormFields({ isRekap, form, set, ph, setPhField, errors }) {
  if (!isRekap) {
    return (
      <>
        <div className="card">
          <h2>Produksi</h2>
          <label>Buka Kelapa (Kg)<ErrMark show={errors?.bkKlp} /></label>
          <KgInput value={form.bkKlp} onChange={v => set('bkKlp', v)} placeholder="contoh: 325676.3" className={errClass('bkKlp', errors)} />
          <label>Pakai Jambul (Kg)<ErrMark show={errors?.pakaiJmbl} /></label>
          <KgInput value={form.pakaiJmbl} onChange={v => set('pakaiJmbl', v)} placeholder="contoh: 266455" className={errClass('pakaiJmbl', errors)} />
          <label>Rijek (desimal, contoh 0.0156 = 1,56%)<ErrMark show={errors?.rijek} /></label>
          <input type="text" inputMode="decimal" className={errClass('rijek', errors)} value={form.rijek || ''} onChange={e => set('rijek', e.target.value)} placeholder="contoh: 0.0156" />
          <label>Sisa Kelapa<ErrMark show={errors?.sisaKlp} /></label>
          <input type="text" className={errClass('sisaKlp', errors)} value={form.sisaKlp || ''} onChange={e => set('sisaKlp', e.target.value)} placeholder="contoh: 0 Tank" />
        </div>

        <div className="card">
          <h2>Kehadiran Sheller</h2>
          <label>Format: B136,H0,L0=136dr154=88,31%<ErrMark show={errors?.khdrnSh} /></label>
          <input type="text" className={errClass('khdrnSh', errors)} value={form.khdrnSh || ''} onChange={e => set('khdrnSh', e.target.value)} placeholder="B136,H0,L0=136dr154=88,31%" />
          <label>Rata-rata Sheller<ErrMark show={errors?.rt2Sh} /></label>
          <input type="text" className={errClass('rt2Sh', errors)} value={form.rt2Sh || ''} onChange={e => set('rt2Sh', e.target.value)} placeholder="B2395,H0,L0= Rata 2395" />
        </div>

        <div className="card">
          <h2>Kehadiran Parer</h2>
          <label>Format: B358,H13,L0=371dr408=90,93%<ErrMark show={errors?.khdrnPr} /></label>
          <input type="text" className={errClass('khdrnPr', errors)} value={form.khdrnPr || ''} onChange={e => set('khdrnPr', e.target.value)} placeholder="B358,H13,L0=371dr408=90,93%" />
          <label>Rata-rata Parer<ErrMark show={errors?.rt2Pr} /></label>
          <input type="text" className={errClass('rt2Pr', errors)} value={form.rt2Pr || ''} onChange={e => set('rt2Pr', e.target.value)} placeholder="B845,H0,L0=Rata 845" />
        </div>

        <div className="card">
          <h2>White Meat & Air</h2>
          <label>Kg White Meat<ErrMark show={errors?.kgWm} /></label>
          <KgInput value={form.kgWm} onChange={v => set('kgWm', v)} placeholder="contoh: 114746.5" className={errClass('kgWm', errors)} />
          <label>Air MP1 (Kg)<ErrMark show={errors?.airMp1} /></label>
          <KgInput value={form.airMp1} onChange={v => set('airMp1', v)} placeholder="contoh: 84676.06" className={errClass('airMp1', errors)} />
          <label>Air MP2 (Kg)<ErrMark show={errors?.airMp2} /></label>
          <KgInput value={form.airMp2} onChange={v => set('airMp2', v)} placeholder="contoh: 1218.6" className={errClass('airMp2', errors)} />
          <p className="sub" style={{ marginTop: 8 }}>EF WM, EF FCW, dan Total dihitung otomatis oleh formula Excel</p>
        </div>

        <div className="card">
          <h2>PH Santan</h2>
          <p className="sub">Pilih jam mulai & selesai (bisa diketik), lalu isi nilai PH dipisah garis miring. Semua wajib diisi — kalau memang tidak ada, isi 0.</p>
          {PH_LINES.map(line => (
            <div key={line} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <label>Line {line}</label>
              <div className="grid2">
                <div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Dari jam<ErrMark show={errors?.[`ph_${line}_dari`]} /></span>
                  <input type="time" className={errClass(`ph_${line}_dari`, errors)} value={ph[line].dari} onChange={e => setPhField(line, 'dari', e.target.value)} />
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sampai jam<ErrMark show={errors?.[`ph_${line}_sampai`]} /></span>
                  <input type="time" className={errClass(`ph_${line}_sampai`, errors)} value={ph[line].sampai} onChange={e => setPhField(line, 'sampai', e.target.value)} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nilai PH<ErrMark show={errors?.[`ph_${line}_nilai`]} /></span>
              <input type="text" className={errClass(`ph_${line}_nilai`, errors)} value={ph[line].nilai} onChange={e => setPhField(line, 'nilai', e.target.value)} placeholder="6,05/6,08/6,06" />
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
        <label>Stok di Petak (Kg)<ErrMark show={errors?.stokPetak} /></label>
        <KgInput value={form.stokPetak} onChange={v => set('stokPetak', v)} className={errClass('stokPetak', errors)} />
        <label>Stok di Bufer (Kg)<ErrMark show={errors?.stokBufer} /></label>
        <KgInput value={form.stokBufer} onChange={v => set('stokBufer', v)} className={errClass('stokBufer', errors)} />
        <p className="sub" style={{ marginTop: 8 }}>Total Stok dihitung otomatis oleh Excel</p>
      </div>

      <div className="card">
        <h2>Akumulasi</h2>
        <label>Akum BK KLP (Kg)<ErrMark show={errors?.akumBkKlp} /></label>
        <KgInput value={form.akumBkKlp} onChange={v => set('akumBkKlp', v)} className={errClass('akumBkKlp', errors)} />
        <label>Akum Air MP1+MP2 (Kg)<ErrMark show={errors?.akumAir} /></label>
        <KgInput value={form.akumAir} onChange={v => set('akumAir', v)} className={errClass('akumAir', errors)} />
        <p className="sub" style={{ marginTop: 8 }}>EF FCW MP1+MP2 dihitung otomatis oleh formula Excel</p>
      </div>

      <div className="card">
        <h2>DC & Santan</h2>
        <label>DC (Kg)<ErrMark show={errors?.dc} /></label>
        <KgInput value={form.dc} onChange={v => set('dc', v)} className={errClass('dc', errors)} />
        <label>Akum DC (Kg)<ErrMark show={errors?.akumDc} /></label>
        <KgInput value={form.akumDc} onChange={v => set('akumDc', v)} className={errClass('akumDc', errors)} />
        <label>Santan L.A (Kg)<ErrMark show={errors?.santanLA} /></label>
        <KgInput value={form.santanLA} onChange={v => set('santanLA', v)} className={errClass('santanLA', errors)} />
        <label>TTL Santan (Kg)<ErrMark show={errors?.ttlSantan} /></label>
        <KgInput value={form.ttlSantan} onChange={v => set('ttlSantan', v)} className={errClass('ttlSantan', errors)} />
        <label>Akum Santan (Kg)<ErrMark show={errors?.akumSantan} /></label>
        <KgInput value={form.akumSantan} onChange={v => set('akumSantan', v)} className={errClass('akumSantan', errors)} />
        <label>Sisa Kelapa<ErrMark show={errors?.sisaKlp} /></label>
        <input type="text" className={errClass('sisaKlp', errors)} value={form.sisaKlp || ''} onChange={e => set('sisaKlp', e.target.value)} placeholder="contoh: 0" />
      </div>
    </>
  );
}
