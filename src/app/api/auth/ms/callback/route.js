import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/graph';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/db';

export async function GET(req) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error_description');
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!code) return NextResponse.json({ error: 'Tidak ada authorization code' }, { status: 400 });

  try {
    await exchangeCodeForToken(code);
    const s = await getSession();
    await logAudit(s, 'MS_CONNECTED', null);
    return NextResponse.redirect(new URL('/dashboard?ms=connected', process.env.APP_URL));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
