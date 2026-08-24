import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/auth';
import { logAudit } from '@/lib/db';

export async function POST() {
  const s = await getSession();
  if (s) await logAudit(s, 'LOGOUT', null);
  clearSession();
  return NextResponse.json({ ok: true });
}
