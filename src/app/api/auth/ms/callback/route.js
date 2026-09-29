import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken } from '@/lib/graph';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/db';

const STATE_COOKIE = 'bk_ms_oauth_state';

// KEAMANAN (ditutup 2026-09-29): route ini dulu bisa dipanggil SIAPA SAJA tanpa login sama
// sekali — tinggal buka alur consent Microsoft pakai akun sendiri (client_id/redirect_uri
// bukan rahasia, terlihat di URL redirect /api/auth/ms/start) lalu Microsoft otomatis
// mengarahkan `code`-nya ke callback ini, yang langsung menukar & MENIMPA token di
// `ms_tokens` (satu baris global dipakai SELURUH app utk baca/tulis Excel) — bisa
// melumpuhkan integrasi Excel tanpa butuh akses ke aplikasi ini sama sekali.
// Sekarang dua lapis: (1) requireAuth('superadmin') — harus login sebagai Developer,
// (2) `state` acak (dibuat & disimpan cookie httpOnly oleh /api/auth/ms/start, umur 10
// menit) WAJIB cocok — mencegah CSRF yang menipu Developer yang sedang login supaya
// menukar `code` milik akun Microsoft attacker.
export async function GET(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: 'Hanya developer yang bisa menghubungkan Microsoft' }, { status: auth.status });

  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error_description');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = cookies().get(STATE_COOKIE)?.value;
  cookies().delete(STATE_COOKIE); // sekali pakai, apa pun hasilnya

  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!code) return NextResponse.json({ error: 'Tidak ada authorization code' }, { status: 400 });
  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.json({ error: 'State OAuth tidak valid/kedaluwarsa — ulangi dari menu Dashboard, jangan buka link ini langsung.' }, { status: 400 });
  }

  try {
    await exchangeCodeForToken(code);
    await logAudit(auth.session, 'MS_CONNECTED', null);
    return NextResponse.redirect(new URL('/dashboard?ms=connected', process.env.APP_URL));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
