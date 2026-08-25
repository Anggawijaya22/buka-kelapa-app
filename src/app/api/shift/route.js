import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { SHIFT_LABELS } from '@/lib/excel-map';
import { executeShiftSubmit } from '@/lib/submitFlow';

export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.role === 'viewer') {
    return NextResponse.json({ error: 'Viewer tidak bisa input data' }, { status: 403 });
  }

  const { target, waktu, form } = await req.json();
  if (!SHIFT_LABELS[target]) {
    return NextResponse.json({ error: 'Target shift tidak valid' }, { status: 400 });
  }
  if (!['pagi', 'siang', 'malam'].includes(waktu)) {
    return NextResponse.json({ error: 'Waktu shift tidak valid' }, { status: 400 });
  }
  if (!form?.tanggal) {
    return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
  }

  try {
    const result = await executeShiftSubmit({ target, waktu, form, actorSession: auth.session });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
