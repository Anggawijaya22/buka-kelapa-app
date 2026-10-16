import { db } from './db';
import { getCooldownMinutes } from './settings';

// Developer tidak kena cooldown — supaya tetap bisa input cepat kalau darurat.

// Cek saja (read-only) — dipakai /api/cooldown untuk menampilkan hitung mundur di UI.
export async function checkCooldown(session) {
  if (session.role === 'superadmin') return { ok: true, remainingSeconds: 0 };

  const cooldownMinutes = await getCooldownMinutes();
  if (cooldownMinutes <= 0) return { ok: true, remainingSeconds: 0 };

  const { data: user } = await db.from('users').select('last_submit_at').eq('id', session.id).maybeSingle();
  return remaining(user?.last_submit_at, cooldownMinutes);
}

function remaining(lastSubmitAt, cooldownMinutes) {
  if (lastSubmitAt) {
    const remainingMs = cooldownMinutes * 60000 - (Date.now() - new Date(lastSubmitAt).getTime());
    if (remainingMs > 0) return { ok: false, remainingSeconds: Math.ceil(remainingMs / 1000) };
  }
  return { ok: true, remainingSeconds: 0 };
}

// Klaim slot submit secara ATOMIK, dipanggil DI AWAL sebelum menulis Excel/kirim WA.
// Bug lama (ditemukan 2026-10-16: rekap `maisy` terkirim 2x di menit yang sama): cooldown cuma
// DICEK di awal dan baru DICATAT setelah semua selesai (±20 detik krn tulis Excel cell per cell),
// jadi dua request yang datang bersamaan (klik ganda) sama-sama lolos cek → data & WA dobel.
// Sekarang last_submit_at di-update dengan compare-and-set (hanya berhasil kalau nilainya masih
// sama dgn yang barusan dibaca): request kedua yang kalah balapan langsung ditolak 429.
// Kalau proses setelahnya GAGAL, panggil releaseSubmitSlot() supaya user bisa coba lagi langsung.
export async function claimSubmitSlot(session) {
  const noClaim = { ok: true, remainingSeconds: 0, claimed: false };
  if (session.role === 'superadmin') return noClaim;

  const cooldownMinutes = await getCooldownMinutes();
  if (cooldownMinutes <= 0) return noClaim;

  const { data: user } = await db.from('users').select('last_submit_at').eq('id', session.id).maybeSingle();
  const prev = user?.last_submit_at || null;
  const cd = remaining(prev, cooldownMinutes);
  if (!cd.ok) return cd;

  const now = new Date().toISOString();
  let q = db.from('users').update({ last_submit_at: now }).eq('id', session.id);
  q = prev ? q.eq('last_submit_at', prev) : q.is('last_submit_at', null);
  const { data: won } = await q.select('id');

  if (!won?.length) {
    // Kalah balapan: request lain milik user yang sama baru saja mengklaim slot ini.
    const { data: latest } = await db.from('users').select('last_submit_at').eq('id', session.id).maybeSingle();
    const lost = remaining(latest?.last_submit_at, cooldownMinutes);
    return lost.ok ? { ok: false, remainingSeconds: cooldownMinutes * 60 } : lost;
  }
  return { ok: true, remainingSeconds: 0, claimed: true, userId: session.id, prev, now };
}

// Kembalikan slot kalau proses submit gagal (Excel error, WA gagal, dst) — hanya kalau slotnya
// masih milik klaim ini (tidak menimpa klaim request lain).
export async function releaseSubmitSlot(claim) {
  if (!claim?.claimed) return;
  await db.from('users').update({ last_submit_at: claim.prev }).eq('id', claim.userId).eq('last_submit_at', claim.now);
}
