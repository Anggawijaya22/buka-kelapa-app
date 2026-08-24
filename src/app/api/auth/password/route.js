import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { oldPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
  }

  const { data: user } = await db.from('users').select('*').eq('id', auth.session.id).single();
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return NextResponse.json({ error: 'Password lama salah' }, { status: 401 });
  }

  await db.from('users').update({ password_hash: bcrypt.hashSync(newPassword, 10) }).eq('id', user.id);
  await logAudit(auth.session, 'GANTI_PASSWORD', null);
  return NextResponse.json({ ok: true });
}
