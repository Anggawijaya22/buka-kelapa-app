import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { executeRekapSubmit } from '@/lib/submitFlow';

export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.role === 'viewer') {
    return NextResponse.json({ error: 'Viewer tidak bisa input data' }, { status: 403 });
  }

  const { form } = await req.json();
  if (!form?.tanggal) {
    return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
  }

  try {
    const result = await executeRekapSubmit({ form, actorSession: auth.session });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
