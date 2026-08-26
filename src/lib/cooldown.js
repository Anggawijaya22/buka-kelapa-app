import { db } from './db';
import { getCooldownMinutes } from './settings';

// Developer tidak kena cooldown — supaya tetap bisa input cepat kalau darurat.
export async function checkCooldown(session) {
  if (session.role === 'superadmin') return { ok: true, remainingSeconds: 0 };

  const cooldownMinutes = await getCooldownMinutes();
  if (cooldownMinutes <= 0) return { ok: true, remainingSeconds: 0 };

  const { data: user } = await db.from('users').select('last_submit_at').eq('id', session.id).maybeSingle();
  if (user?.last_submit_at) {
    const elapsedMs = Date.now() - new Date(user.last_submit_at).getTime();
    const remainingMs = cooldownMinutes * 60000 - elapsedMs;
    if (remainingMs > 0) {
      return { ok: false, remainingSeconds: Math.ceil(remainingMs / 1000) };
    }
  }
  return { ok: true, remainingSeconds: 0 };
}

export async function markSubmitted(userId) {
  await db.from('users').update({ last_submit_at: new Date().toISOString() }).eq('id', userId);
}
