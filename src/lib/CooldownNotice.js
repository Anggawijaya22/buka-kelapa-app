'use client';

export default function CooldownNotice({ seconds }) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const label = m > 0 ? `${m} menit ${s} detik` : `${s} detik`;
  return <p className="error" style={{ marginTop: 8 }}>⏳ Tunggu {label} lagi sebelum bisa submit berikutnya.</p>;
}
