// Deteksi anomali EF WM — dipakai bareng oleh form Input Data (submit baru) dan Monitoring
// (edit/kirim ulang), supaya keduanya konsisten: data anomali SELALU lewat antrian approval
// Viewer, tidak peduli apakah dikirim langsung dari Input Data atau disimpan dulu lalu
// dikirim belakangan lewat Monitoring.

// Sama persis dengan range di n8n — supaya deteksi anomali di app cocok dengan yang di WA
export const RANGE_MIN = 0.33;
export const RANGE_MAX = 0.361;

function toIDDecimal(n) {
  return n.toFixed(4).replace('.', ',');
}

// EF WM shift = Kg White Meat / Buka Kelapa (Kg), dihitung sendiri di app sama seperti formula Excel.
export function detectShiftAnomali(form) {
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

// EF WM rekap = nilai akumulasi 3 shift yang SUDAH ada di Excel (bukan dari isian form rekap),
// jadi diambil dari data live dashboard sebelum submit/kirim.
export async function detectRekapAnomali() {
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
