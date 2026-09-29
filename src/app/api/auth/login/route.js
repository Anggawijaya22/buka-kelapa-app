import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, logAudit } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '@/lib/limits';

const LOCKED_MSG = 'Password 5x salah, silahkan hubungi admin';

// Keamanan (2026-09-29): brute force login sebelumnya tidak dibatasi sama sekali. Sekarang
// dilacak per-user lewat kolom users.failed_login_attempts (persist di DB, bukan in-memory,
// supaya tetap efektif di Vercel serverless yang instance-nya tidak persisten). Begitu
// mencapai MAX_FAILED_LOGIN_ATTEMPTS, akun terkunci TOTAL (login ditolak walau passwordnya
// benar) sampai admin/superadmin reset password user itu lewat Pengaturan → Kelola User
// (reset password otomatis membuka kunci — lihat api/users PUT).
// Developer (superadmin) DIKECUALIKAN dari lockout ini (keputusan user) — cuma Developer yang
// bisa "menormalkan" akun lain lewat Kelola User, jadi kalau akun Developer sendiri yang
// terkunci, tidak ada admin lebih tinggi di dalam app utk membukanya lagi.
export async function POST(req) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
  }

  const { data: user } = await db.from('users').select('*').eq('username', username.toLowerCase().trim()).single();
  if (!user) {
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
  }
  const isSuperadmin = user.role === 'superadmin';

  if (!isSuperadmin && user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return NextResponse.json({ error: LOCKED_MSG }, { status: 403 });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    if (!isSuperadmin) {
      const attempts = user.failed_login_attempts + 1;
      await db.from('users').update({ failed_login_attempts: attempts }).eq('id', user.id);
      if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await logAudit(user, 'AKUN_TERKUNCI', { attempts });
        return NextResponse.json({ error: LOCKED_MSG }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
  }

  if (user.failed_login_attempts > 0) {
    await db.from('users').update({ failed_login_attempts: 0 }).eq('id', user.id);
  }
  await createSession(user);
  await logAudit(user, 'LOGIN', null);
  return NextResponse.json({ ok: true, role: user.role, username: user.username, shift: user.shift || null });
}
