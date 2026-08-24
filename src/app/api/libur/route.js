import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/db';
import { triggerN8n } from '@/lib/n8n';

export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.role === 'viewer') {
    return NextResponse.json({ error: 'Viewer tidak bisa kirim notifikasi' }, { status: 403 });
  }

  const { target, waktu, tanggal } = await req.json();
  if (!target || !waktu || !tanggal) {
    return NextResponse.json({ error: 'target, waktu, dan tanggal wajib diisi' }, { status: 400 });
  }

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_LIBUR, { target, waktu, tanggal });
  await logAudit(auth.session, 'KIRIM_LIBUR', { target, waktu, tanggal });

  if (!n8n.ok) {
    return NextResponse.json({ error: n8n.warn }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
