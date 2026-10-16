import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SHIFT_LABELS } from '@/lib/excel-map';
import { executeShiftSubmit } from '@/lib/submitFlow';
import { claimSubmitSlot, releaseSubmitSlot } from '@/lib/cooldown';
import { getCooldownMinutes } from '@/lib/settings';

export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'superadmin'].includes(auth.session.role)) {
    return NextResponse.json({ error: 'Anda tidak punya akses untuk input data shift' }, { status: 403 });
  }

  const { target, waktu, form, mode } = await req.json();
  const isDraft = mode === 'draft';
  if (!SHIFT_LABELS[target]) {
    return NextResponse.json({ error: 'Target shift tidak valid' }, { status: 400 });
  }
  if (auth.session.role === 'admin') {
    if (!auth.session.shift) {
      return NextResponse.json({ error: 'Shift Anda belum diset. Hubungi developer.' }, { status: 403 });
    }
    if (auth.session.shift !== target) {
      return NextResponse.json({ error: 'Anda hanya bisa input data untuk shift yang ditugaskan' }, { status: 403 });
    }
  }
  if (!['pagi', 'siang', 'malam'].includes(waktu)) {
    return NextResponse.json({ error: 'Waktu shift tidak valid' }, { status: 400 });
  }
  if (!form?.tanggal) {
    return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
  }

  // Simpan sebagai draft TIDAK kena cooldown (tidak kirim WA/Excel sama sekali).
  // Selain draft: slot cooldown DIKLAIM atomik di awal (cegah klik ganda lolos dua-duanya),
  // dan dilepas lagi kalau proses gagal supaya user bisa langsung coba ulang.
  let claim = null;
  if (!isDraft) {
    claim = await claimSubmitSlot(auth.session);
    if (!claim.ok) {
      return NextResponse.json({ error: `Tunggu ${claim.remainingSeconds} detik lagi sebelum submit berikutnya`, cooldownRemainingSeconds: claim.remainingSeconds }, { status: 429 });
    }
  }

  try {
    const result = await executeShiftSubmit({ target, waktu, form, actorSession: auth.session, mode: isDraft ? 'draft' : 'sent' });
    if (isDraft) {
      return NextResponse.json({ ok: true, ...result });
    }
    const cooldownMinutes = await getCooldownMinutes();
    return NextResponse.json({ ok: true, ...result, cooldownSeconds: cooldownMinutes * 60 });
  } catch (e) {
    await releaseSubmitSlot(claim);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
