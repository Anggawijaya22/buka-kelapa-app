import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { executeRekapSubmit } from '@/lib/submitFlow';
import { checkCooldown, markSubmitted } from '@/lib/cooldown';
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

  // Simpan sebagai draft TIDAK kena cooldown (tidak kirim WA/Excel sama sekali)
  if (!isDraft) {
    const cd = await checkCooldown(auth.session);
    if (!cd.ok) {
      return NextResponse.json({ error: `Tunggu ${cd.remainingSeconds} detik lagi sebelum submit berikutnya`, cooldownRemainingSeconds: cd.remainingSeconds }, { status: 429 });
    }
  }

  try {
    const result = await executeRekapSubmit({ form, actorSession: auth.session, mode: isDraft ? 'draft' : 'sent' });
    if (isDraft) {
      return NextResponse.json({ ok: true, ...result });
    }
    await markSubmitted(auth.session.id);
    const cooldownMinutes = await getCooldownMinutes();
    return NextResponse.json({ ok: true, ...result, cooldownSeconds: cooldownMinutes * 60 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
