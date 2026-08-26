import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data } = await db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  return NextResponse.json({ logs: data });
}

export async function DELETE(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await db.from('audit_logs').delete().neq('id', 0);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
