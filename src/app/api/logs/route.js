import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Admin & viewer hanya lihat log sendiri; superadmin lihat semua
  let q = db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (auth.session.role !== 'superadmin') {
    q = q.eq('user_id', auth.session.id);
  }
  const { data } = await q;
  return NextResponse.json({ logs: data });
}

export async function DELETE(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Hanya superadmin yang boleh hapus log' }, { status: 403 });
  }

  const { error } = await db.from('audit_logs').delete().neq('id', 0);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
