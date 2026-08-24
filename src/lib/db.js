import { createClient } from '@supabase/supabase-js';

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

export async function logAudit(user, action, detail) {
  await db.from('audit_logs').insert({
    user_id: user?.id || null,
    username: user?.username || 'system',
    action,
    detail
  });
}
