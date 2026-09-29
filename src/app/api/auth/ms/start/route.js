import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/auth';

const STATE_COOKIE = 'bk_ms_oauth_state';

// Keamanan: `state` OAuth acak disimpan di cookie httpOnly berumur pendek (10 menit) dan
// diverifikasi di /api/auth/ms/callback sebelum menukar code apa pun — mencegah endpoint
// callback dipakai (lewat CSRF ataupun langsung tanpa login) untuk menimpa token Microsoft
// yang tersimpan (ms_tokens id=1, dipakai SELURUH app utk baca/tulis Excel) dengan token
// milik akun lain. Lihat catatan lengkap di /api/auth/ms/callback/route.js.
export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: 'Hanya developer yang bisa menghubungkan Microsoft' }, { status: auth.status });

  const state = randomBytes(24).toString('hex');
  cookies().set(STATE_COOKIE, state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 600, path: '/api/auth/ms'
  });

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MS_REDIRECT_URI,
    scope: 'offline_access Files.ReadWrite Files.ReadWrite.All',
    response_mode: 'query',
    state
  });
  return NextResponse.redirect(`https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`);
}
