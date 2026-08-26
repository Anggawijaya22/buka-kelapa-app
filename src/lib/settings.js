import { db } from './db';

const DEFAULT_COOLDOWN_MINUTES = 3;
const COOLDOWN_KEY = 'submit_cooldown_minutes';

export async function getCooldownMinutes() {
  const { data } = await db.from('app_settings').select('value').eq('key', COOLDOWN_KEY).maybeSingle();
  const n = data ? parseInt(data.value, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COOLDOWN_MINUTES;
}

export async function setCooldownMinutes(minutes) {
  await db.from('app_settings').upsert({ key: COOLDOWN_KEY, value: String(minutes), updated_at: new Date().toISOString() });
}
