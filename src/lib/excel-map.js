// ============================================
// PEMETAAN FIELD FORM → CELL EXCEL
// Sheet: Laporan SMS 2 (KG)
// Shift A = kolom D | Shift B = kolom M | Shift C = kolom S
// Rekap  = kolom D (baris 37-61)
// ============================================

const SHIFT_COLS = { shiftA: 'D', shiftB: 'M', shiftC: 'S' };

export const SHIFT_LABELS = {
  shiftA: 'Shift A (Siang)',
  shiftB: 'Shift B (Malam)',
  shiftC: 'Shift C (Pagi)'
};

// Label waktu shift yang SEBENARNYA dipilih user — dipakai utk header baris 4 di Excel
// (B4/K4/Q4), supaya header ikut berubah sesuai pilihan Pagi/Siang/Malam, bukan patokan tetap.
const WAKTU_LABELS = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };
const HEADER_ROW = 4;

// Field manual per shift → row Excel
// EF dan Total TIDAK ditulis — itu formula di Excel
const SHIFT_ROWS = {
  tanggal: 5,
  bkKlp: 6,
  pakaiJmbl: 7,
  khdrnSh: 10,
  rijek: 11,
  rt2Sh: 12,
  khdrnPr: 13,
  rt2Pr: 14,
  kgWm: 15,
  airMp1: 17,
  airMp2: 19,
  sisaKlp: 24
};

// PH Santan: label (kolom B/K/Q) + nilai — baris 25-34, pasangan (label, nilai)
// Label ditulis di kolom LABEL (2 kolom sebelum kolom nilai): B utk shiftA, K utk shiftB, Q utk shiftC
const LABEL_COLS = { shiftA: 'B', shiftB: 'K', shiftC: 'Q' };
const PH_ROWS = [
  { line: 'A', labelRow: 25, valueRow: 26 },
  { line: 'B', labelRow: 27, valueRow: 28 },
  { line: 'C', labelRow: 29, valueRow: 30 },
  { line: 'D', labelRow: 31, valueRow: 32 },
  { line: 'E', labelRow: 33, valueRow: 34 }
];

// Bangun map { "D5": nilai, "D6": nilai, ... } dari payload form shift.
// waktu ('pagi'|'siang'|'malam') dipakai utk update header baris 4 (mis. "Shift A (Malam)")
// mengikuti pilihan user saat itu, bukan cuma "Shift A (Siang)" yang tetap.
export function buildShiftCellMap(target, form, waktu) {
  const col = SHIFT_COLS[target];
  const labelCol = LABEL_COLS[target];
  if (!col) throw new Error('Target shift tidak dikenal: ' + target);

  const map = {};

  if (WAKTU_LABELS[waktu]) {
    map[`${labelCol}${HEADER_ROW}`] = `Shift ${target.slice(-1)} (${WAKTU_LABELS[waktu]})`;
  }

  // Field utama. Khusus 'tanggal': tulis format ISO "YYYY-MM-DD" (form.tanggalIso), BUKAN
  // "DD/MM/YY" (form.tanggal) — ISO tidak ambigu di mata Excel apa pun locale-nya, sedangkan
  // "DD/MM/YY" bisa salah dibaca jadi MM/DD (mis. "02/09/26" dibaca 9 Februari, bukan 2 September)
  // kalau locale workbook/session Graph API-nya en-US. Lihat juga buildRekapCellMap &
  // buildShiftLiburCellMap yang punya masalah sama.
  for (const [field, row] of Object.entries(SHIFT_ROWS)) {
    const v = field === 'tanggal' ? (form.tanggalIso || form[field]) : form[field];
    if (v !== undefined && v !== null && v !== '') {
      map[`${col}${row}`] = v;
    }
  }

  // PH Santan per line: { jam: "15.30 - 20.30", nilai: "6,05/6,08/..." }
  if (form.phSantan) {
    for (const ph of PH_ROWS) {
      const entry = form.phSantan[ph.line];
      if (entry && (entry.jam || entry.nilai)) {
        if (entry.jam) {
          map[`${labelCol}${ph.labelRow}`] = `PH SANTAN L.${ph.line}  ${entry.jam}`;
        }
        if (entry.nilai) {
          map[`${labelCol}${ph.valueRow}`] = `(${entry.nilai})`;
        }
      }
    }
  }

  return map;
}

// Bangun map utk tombol LIBUR PRODUKSI (per shift) — kolom Tanggal DIUPDATE ke hari ini,
// SEMUA field data + PH Santan lainnya DIKOSONGKAN ("") supaya tidak ada data lama shift ini
// yang nyangkut kelihatan seolah masih berlaku. Header baris 4 SENGAJA tidak disentuh.
// Dipakai lewat writeCellsForce() (bukan writeCells()) karena string kosong di sini harus
// benar-benar ditulis, bukan dilewati.
// tanggalIso: format ISO "YYYY-MM-DD" — lihat catatan ambiguitas tanggal di buildShiftCellMap.
export function buildShiftLiburCellMap(target, tanggalIso) {
  const col = SHIFT_COLS[target];
  const labelCol = LABEL_COLS[target];
  if (!col) throw new Error('Target shift tidak dikenal: ' + target);

  const map = {};
  for (const [field, row] of Object.entries(SHIFT_ROWS)) {
    map[`${col}${row}`] = field === 'tanggal' ? tanggalIso : '';
  }
  for (const ph of PH_ROWS) {
    map[`${labelCol}${ph.labelRow}`] = '';
    map[`${labelCol}${ph.valueRow}`] = '';
  }
  return map;
}

// Field manual rekap harian → row Excel (kolom D)
const REKAP_ROWS = {
  tanggal: 37,
  stokPetak: 38,
  stokBufer: 42,
  akumBkKlp: 45,
  akumAir: 54,
  // efFcwMp12 (baris 55) SENGAJA tidak ditulis — itu formula Excel, bukan input manual.
  dc: 56,
  akumDc: 57,
  santanLA: 58,
  ttlSantan: 59,
  akumSantan: 60
};
// Sisa Kelapa rekap ada di kolom E row 61
const REKAP_SISA_CELL = 'E61';

export function buildRekapCellMap(form) {
  const map = {};
  for (const [field, row] of Object.entries(REKAP_ROWS)) {
    // Khusus 'tanggal': pakai ISO (tidak ambigu) — lihat catatan di buildShiftCellMap.
    const v = field === 'tanggal' ? (form.tanggalIso || form[field]) : form[field];
    if (v !== undefined && v !== null && v !== '') {
      map[`D${row}`] = v;
    }
  }
  if (form.sisaKlp !== undefined && form.sisaKlp !== '') {
    map[REKAP_SISA_CELL] = form.sisaKlp;
  }
  return map;
}
