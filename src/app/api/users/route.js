import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';

export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data } = await db.from('users').select('id, username, role, created_at').order('created_at');
  return NextResponse.json({ users: data });
}

export async function POST(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { username, password, role } = await req.json();
  if (!username || !password || password.length < 6) {
    return NextResponse.json({ error: 'Username wajib, password minimal 6 karakter' }, { status: 400 });
  }

  const { error } = await db.from('users').insert({
    username: username.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role: ['superadmin','admin','viewer'].includes(role) ? role : 'admin'
  });
  if (error) return NextResponse.json({ error: 'Username sudah dipakai' }, { status: 409 });

  await logAudit(auth.session, 'TAMBAH_USER', { username });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json();
  if (id === auth.session.id) {
    return NextResponse.json({ error: 'Tidak bisa hapus akun sendiri' }, { status: 400 });
  }
  const { data: target } = await db.from('users').select('username').eq('id', id).single();
  await db.from('users').delete().eq('id', id);
  await logAudit(auth.session, 'HAPUS_USER', { username: target?.username });
  return NextResponse.json({ ok: true });
}

export async function PUT(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, password } = await req.json();
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
  }
  const { data: target } = await db.from('users').select('username').eq('id', id).single();
  await db.from('users').update({ password_hash: bcrypt.hashSync(password, 10) }).eq('id', id);
  await logAudit(auth.session, 'RESET_PASSWORD_USER', { username: target?.username });
  return NextResponse.json({ ok: true });
}
