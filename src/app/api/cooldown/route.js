import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkCooldown } from '@/lib/cooldown';
import { getCooldownMinutes } from '@/lib/settings';

// Dipakai halaman Input Data & History untuk inisialisasi hitung mundur cooldown
// saat halaman dibuka/reload (bukan cuma setelah submit di sesi yang sama).
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [cd, cooldownMinutes] = await Promise.all([
    checkCooldown(auth.session),
    getCooldownMinutes()
  ]);
  return NextResponse.json({ remainingSeconds: cd.ok ? 0 : cd.remainingSeconds, cooldownMinutes });
}
