import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { executeRekapSubmit } from '@/lib/submitFlow';
import { claimSubmitSlot, releaseSubmitSlot } from '@/lib/cooldown';
import { getCooldownMinutes } from '@/lib/settings';

export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['admin_atas', 'superadmin'].includes(auth.session.role)) {
    return NextResponse.json({ error: 'Hanya Admin Atas/Developer yang bisa input rekap harian' }, { status: 403 });
  }

  const { form, mode } = await req.json();
  const isDraft = mode === 'draft';
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
    const result = await executeRekapSubmit({ form, actorSession: auth.session, mode: isDraft ? 'draft' : 'sent' });
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
