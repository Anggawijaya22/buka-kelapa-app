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

// Bangun map { "D5": nilai, "D6": nilai, ... } dari payload form shift
export function buildShiftCellMap(target, form) {
  const col = SHIFT_COLS[target];
  const labelCol = LABEL_COLS[target];
  if (!col) throw new Error('Target shift tidak dikenal: ' + target);

  const map = {};

  // Field utama
  for (const [field, row] of Object.entries(SHIFT_ROWS)) {
    const v = form[field];
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

// Field manual rekap harian → row Excel (kolom D)
const REKAP_ROWS = {
  tanggal: 37,
  stokPetak: 38,
  stokBufer: 42,
  akumBkKlp: 45,
  akumAir: 54,
  efFcwMp12: 55,
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
    const v = form[field];
    if (v !== undefined && v !== null && v !== '') {
      map[`D${row}`] = v;
    }
  }
  if (form.sisaKlp !== undefined && form.sisaKlp !== '') {
    map[REKAP_SISA_CELL] = form.sisaKlp;
  }
  return map;
}
