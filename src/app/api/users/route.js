import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';

export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data } = await db.from('users').select('id, username, role, shift, created_at').order('created_at');
  return NextResponse.json({ users: data });
}

const VALID_SHIFTS = ['shiftA', 'shiftB', 'shiftC'];

export async function POST(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { username, password, role, shift } = await req.json();
  if (!username || !password || password.length < 6) {
    return NextResponse.json({ error: 'Username wajib, password minimal 6 karakter' }, { status: 400 });
  }

  const finalRole = ['superadmin', 'admin', 'admin_atas', 'viewer'].includes(role) ? role : 'admin';
  if (finalRole === 'admin' && shift && !VALID_SHIFTS.includes(shift)) {
    return NextResponse.json({ error: 'Shift tidak valid' }, { status: 400 });
  }

  const { error } = await db.from('users').insert({
    username: username.toLowerCase().trim(),
    password_hash: bcrypt.hashSync(password, 10),
    role: finalRole,
    shift: finalRole === 'admin' ? (shift || null) : null
  });
  if (error) return NextResponse.json({ error: 'Username sudah dipakai' }, { status: 409 });

  await logAudit(auth.session, 'TAMBAH_USER', { username, role: finalRole, shift: finalRole === 'admin' ? (shift || null) : null });
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
  if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

  const { error } = await db.from('users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Gagal menghapus user: ' + error.message }, { status: 500 });

  await logAudit(auth.session, 'HAPUS_USER', { username: target.username });
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

export async function PATCH(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, shift } = await req.json();
  if (!id || (shift && !VALID_SHIFTS.includes(shift))) {
    return NextResponse.json({ error: 'Shift tidak valid' }, { status: 400 });
  }
  const { data: target } = await db.from('users').select('username, role').eq('id', id).single();
  if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
  if (target.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya user role Admin yang punya shift' }, { status: 400 });
  }
  await db.from('users').update({ shift: shift || null }).eq('id', id);
  await logAudit(auth.session, 'UBAH_SHIFT_USER', { username: target.username, shift: shift || null });
  return NextResponse.json({ ok: true });
}
