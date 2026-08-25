'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Nav from '@/lib/Nav';
import KgInput from '@/lib/KgInput';

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
// "23:30" → "23.30"
function timeToDot(t) {
  return (t || '').replace(':', '.');
}
function toIDDecimal(n) {
  return n.toFixed(4).replace('.', ',');
}

// Modal konfirmasi anomali — dipakai berbasis Promise (mirip window.confirm tapi custom 2 tombol)
function useAnomaliConfirm() {
  const [state, setState] = useState(null); // { message, resolve }

  function confirmAnomali(message) {
    return new Promise(resolve => {
      setState({ message, resolve });
    });
  }
  function handle(result) {
    state.resolve(result);
    setState(null);
  }

  const modal = state ? (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', margin: 0 }}>
        <h2 style={{ color: 'var(--warn)' }}>⚠️ Anomali Terdeteksi</h2>
        <p style={{ whiteSpace: 'pre-line', fontSize: 14, marginBottom: 4 }}>{state.message}</p>
        <button onClick={() => handle(true)}>✅ Tetap Kirim</button>
        <button type="button" className="secondary" onClick={() => handle(false)}>✏️ Revisi Data</button>
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
  const [anomaliModal, confirmAnomali] = useAnomaliConfirm();

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function setPhField(line, key, value) {
    setPh(p => ({ ...p, [line]: { ...p[line], [key]: value } }));
  }

  // Cek anomali EF WM shift SEBELUM kirim — dihitung sendiri di app (EF WM = Kg WM / Buka Kelapa)
  // sama seperti formula Excel. Hanya MENDETEKSI, tidak menampilkan dialog — dialog diatur di submit().
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

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    const deteksi = isRekap ? await deteksiAnomaliRekap() : deteksiAnomaliShift();

    if (deteksi.anomali) {
      const pesan = `${deteksi.reason}\n\nAnda bisa:\n• Tetap Kirim — data akan dikirim ke Viewer untuk di-ACC dulu sebelum masuk Excel\n• Revisi Data — kembali mengecek isian form`;
      const tetapKirim = await confirmAnomali(pesan);
      if (!tetapKirim) return; // Revisi — kembali ke form, tidak ada yang dikirim

      // Tetap Kirim → JANGAN langsung ke Excel/n8n, kirim dulu ke antrian approval Viewer/Superadmin
      setLoading(true);
      const payload = {
        ...form,
        tanggal: toExcelDate(form.tanggal),
        tanggalIso: form.tanggal
      };
      if (!isRekap) {
        const phOut = {};
        for (const line of ['A', 'B', 'C', 'D', 'E']) {
          const p = ph[line];
          const jam = (p.dari && p.sampai) ? `${timeToDot(p.dari)} - ${timeToDot(p.sampai)}` : '';
          phOut[line] = { jam, nilai: p.nilai || '' };
        }
        payload.phSantan = phOut;
      }

      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, waktu, form: payload, efWmPreview: deteksi.efWm, reason: deteksi.reason })
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setMsg({ type: 'error', text: data.error });
        return;
      }
      let anomaliText = '📨 Data anomali terkirim ke Viewer untuk persetujuan. Excel belum diupdate sampai di-ACC.';
      anomaliText += data.waSent ? ' Notifikasi WA ke Viewer terkirim 📱' : ' (Notifikasi WA gagal terkirim, tapi tetap bisa dilihat Viewer di app)';
      setMsg({ type: 'success', text: anomaliText });
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
      {anomaliModal}
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
        )}

        {isRekap && (
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
