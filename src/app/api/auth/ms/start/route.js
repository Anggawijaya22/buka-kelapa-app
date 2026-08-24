import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: 'Hanya superadmin yang bisa menghubungkan Microsoft' }, { status: auth.status });

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MS_REDIRECT_URI,
    scope: 'offline_access Files.ReadWrite Files.ReadWrite.All',
    response_mode: 'query'
  });
  return NextResponse.redirect(`https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`);
}
