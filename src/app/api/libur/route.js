import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/db';
import { triggerN8n } from '@/lib/n8n';
import { checkCooldown, markSubmitted } from '@/lib/cooldown';
import { getCooldownMinutes } from '@/lib/settings';
import { executeShiftLibur } from '@/lib/submitFlow';

export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { target, waktu, tanggal } = await req.json();
  const isRekap = target === 'rekap';

  if (!target || !tanggal || (!isRekap && !waktu)) {
    return NextResponse.json({ error: `target, tanggal${isRekap ? '' : ', dan waktu'} wajib diisi` }, { status: 400 });
  }

  if (isRekap) {
    if (!['admin_atas', 'superadmin'].includes(auth.session.role)) {
      return NextResponse.json({ error: 'Hanya Admin Atas/Developer yang bisa kirim notifikasi rekap harian' }, { status: 403 });
    }
  } else {
    if (!['admin', 'superadmin'].includes(auth.session.role)) {
      return NextResponse.json({ error: 'Anda tidak punya akses untuk input data shift' }, { status: 403 });
    }
    if (auth.session.role === 'admin') {
      if (!auth.session.shift) {
        return NextResponse.json({ error: 'Shift Anda belum diset. Hubungi developer.' }, { status: 403 });
      }
      if (auth.session.shift !== target) {
        return NextResponse.json({ error: 'Anda hanya bisa kirim notifikasi untuk shift yang ditugaskan' }, { status: 403 });
      }
    }
  }

  const cd = await checkCooldown(auth.session);
  if (!cd.ok) {
    return NextResponse.json({ error: `Tunggu ${cd.remainingSeconds} detik lagi sebelum submit berikutnya`, cooldownRemainingSeconds: cd.remainingSeconds }, { status: 429 });
  }

  if (isRekap) {
    // Rekap libur (ketiga shift libur sekaligus) — TIDAK menyentuh Excel sama sekali, cuma notif WA
    // (sesuai keputusan: fitur pengosongan Excel cukup utk shift dulu, rekap tetap seperti semula).
    const n8n = await triggerN8n(process.env.N8N_WEBHOOK_LIBUR_REKAP, { target, waktu: null, tanggal });
    await logAudit(auth.session, 'KIRIM_LIBUR', { target, waktu: null, tanggal });

    if (!n8n.ok) {
      return NextResponse.json({ error: n8n.warn }, { status: 500 });
    }
    await markSubmitted(auth.session.id);
    const cooldownMinutes = await getCooldownMinutes();
    return NextResponse.json({ ok: true, cooldownSeconds: cooldownMinutes * 60 });
  }

  // Shift libur — kosongkan cell data+PH Santan shift terkait di Excel (kolom Tanggal tetap
  // diupdate), lalu trigger notif WA seperti biasa. Lihat executeShiftLibur() di submitFlow.js.
  let result;
  try {
    result = await executeShiftLibur({ target, waktu, tanggalDisplay: tanggal, actorSession: auth.session });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Gagal mengosongkan data Excel' }, { status: 500 });
  }

  if (!result.waSent) {
    return NextResponse.json({ error: result.warn }, { status: 500 });
  }
  await markSubmitted(auth.session.id);
  const cooldownMinutes = await getCooldownMinutes();
  return NextResponse.json({ ok: true, cooldownSeconds: cooldownMinutes * 60 });
}
