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
  if (!isRekap && auth.session.role === 'admin') {
    if (!auth.session.shift) {
      return NextResponse.json({ error: 'Shift Anda belum diset. Hubungi superadmin.' }, { status: 403 });
    }
    if (auth.session.shift !== target) {
      return NextResponse.json({ error: 'Anda hanya bisa kirim notifikasi untuk shift yang ditugaskan' }, { status: 403 });
    }
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
