import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/db';
import { getCooldownMinutes, setCooldownMinutes } from '@/lib/settings';

const MAX_COOLDOWN_MINUTES = 120;

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const cooldownMinutes = await getCooldownMinutes();
  return NextResponse.json({ cooldownMinutes });
}

export async function PUT(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { cooldownMinutes } = await req.json();
  const n = parseInt(cooldownMinutes, 10);
  if (!Number.isFinite(n) || n < 0 || n > MAX_COOLDOWN_MINUTES) {
    return NextResponse.json({ error: `Nilai tidak valid (0-${MAX_COOLDOWN_MINUTES} menit)` }, { status: 400 });
  }

  await setCooldownMinutes(n);
  await logAudit(auth.session, 'UBAH_PENGATURAN', { submit_cooldown_minutes: n });
  return NextResponse.json({ ok: true, cooldownMinutes: n });
}
