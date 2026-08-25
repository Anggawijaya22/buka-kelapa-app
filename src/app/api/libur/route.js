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
  const isRekap = target === 'rekap';

  if (!target || !tanggal || (!isRekap && !waktu)) {
    return NextResponse.json({ error: `target, tanggal${isRekap ? '' : ', dan waktu'} wajib diisi` }, { status: 400 });
  }

  // Shift libur (shiftA/B/C + waktu) pakai N8N_WEBHOOK_LIBUR.
  // Rekap libur (ketiga shift libur sekaligus) pakai webhook terpisah N8N_WEBHOOK_LIBUR_REKAP.
  const webhookUrl = isRekap ? process.env.N8N_WEBHOOK_LIBUR_REKAP : process.env.N8N_WEBHOOK_LIBUR;

  const n8n = await triggerN8n(webhookUrl, { target, waktu: waktu || null, tanggal });
  await logAudit(auth.session, 'KIRIM_LIBUR', { target, waktu: waktu || null, tanggal });

  if (!n8n.ok) {
    return NextResponse.json({ error: n8n.warn }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
