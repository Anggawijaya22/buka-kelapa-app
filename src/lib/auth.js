import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE = 'bk_session';

export async function createSession(user) {
  const token = await new SignJWT({
    id: user.id, username: user.username, role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret);
  cookies().set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12, path: '/'
  });
}

export async function getSession() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch { return null; }
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function requireAuth(role) {
  const s = await getSession();
  if (!s) return { error: 'Unauthorized', status: 401 };
  if (role && s.role !== role) return { error: 'Forbidden', status: 403 };
  return { session: s };
}
