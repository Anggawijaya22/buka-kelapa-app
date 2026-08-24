import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(req) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
  }

  const { data: user } = await db.from('users').select('*').eq('username', username.toLowerCase().trim()).single();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
  }

  await createSession(user);
  await logAudit(user, 'LOGIN', null);
  return NextResponse.json({ ok: true, role: user.role, username: user.username });
}
