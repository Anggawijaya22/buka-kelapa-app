'use client';
import { useState } from 'react';

// Format raw "12345.6" (titik = desimal, tanpa pemisah) -> tampilan "12.345,6" (ID: titik ribuan, koma desimal)
export function formatKg(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  const s = String(raw);
  const [intPartRaw, decPart] = s.split('.');
  const neg = intPartRaw.startsWith('-');
  const intDigits = (neg ? intPartRaw.slice(1) : intPartRaw).replace(/\D/g, '');
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  let out = (neg ? '-' : '') + grouped;
  if (decPart !== undefined) out += ',' + decPart.replace(/\D/g, '');
  return out;
}

export function parseKgInput(raw) {
  // Kompatibilitas: raw sudah berupa "12345.6" polos (titik desimal, tanpa pemisah ribuan) — dipakai langsung
  return raw === undefined || raw === null ? '' : String(raw);
}

// Input Kg: saat mengetik tampil apa adanya (digit + SATU pemisah desimal — titik ATAU koma, sesuai
// yang diketik user, karena keyboard angka HP kadang cuma punya tombol koma). Setelah pindah field
// (blur), otomatis tampil dengan pemisah ribuan ala Indonesia (12.345,6). value/onChange tetap pakai
// format RAW dengan titik sebagai desimal ("12345.6") — kontrak data ke Excel TIDAK berubah.
export default function KgInput({ value, onChange, placeholder, required, className }) {
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(null); // apa yang user ketik apa adanya (termasuk koma), null = belum diedit sejak fokus

  const display = focused ? (typed !== null ? typed : (value ?? '')) : formatKg(value);

  function handleChange(e) {
    // Hanya izinkan digit + satu pemisah desimal (titik ATAU koma)
    let v = e.target.value.replace(/[^0-9.,]/g, '');
    const sepIndex = v.search(/[.,]/);
    if (sepIndex === -1) {
      setTyped(v);
      onChange(v);
      return;
    }
    const sep = v[sepIndex];
    const intPart = v.slice(0, sepIndex).replace(/[.,]/g, '');
    const decPart = v.slice(sepIndex + 1).replace(/[.,]/g, '');
    setTyped(intPart + sep + decPart);
    onChange(intPart + '.' + decPart);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={display}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setTyped(null); }}
      placeholder={placeholder}
      required={required}
    />
  );
}
