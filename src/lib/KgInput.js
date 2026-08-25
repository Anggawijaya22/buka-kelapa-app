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

// Input Kg: saat mengetik tampil apa adanya (angka + titik desimal, seperti input biasa).
// Setelah pindah field (blur), otomatis tampil dengan pemisah ribuan ala Indonesia (12.345,6).
// value/onChange tetap pakai format RAW ("12345.6") — kontrak data ke Excel TIDAK berubah.
export default function KgInput({ value, onChange, placeholder, required }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? (value ?? '') : formatKg(value);

  function handleChange(e) {
    let v = e.target.value;
    // Hanya izinkan digit + satu titik desimal (sama seperti input angka biasa sebelumnya)
    v = v.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    onChange(v);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      required={required}
    />
  );
}
