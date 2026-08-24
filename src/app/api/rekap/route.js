import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';
import { buildRekapCellMap } from '@/lib/excel-map';
import { writeCells } from '@/lib/graph';
import { triggerN8n } from '@/lib/n8n';

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
    const cellMap = buildRekapCellMap(form);
    const written = await writeCells(cellMap);

    await db.from('submissions').insert({
      user_id: auth.session.id,
      username: auth.session.username,
      target: 'rekap',
      tanggal: form.tanggalIso || null,
      payload: form
    });
    await logAudit(auth.session, 'SUBMIT_REKAP', { tanggal: form.tanggal, cells: written.length });

    const n8n = await triggerN8n(process.env.N8N_WEBHOOK_REKAP, { tanggal: form.tanggal });

    return NextResponse.json({
      ok: true,
      cellsWritten: written.length,
      waSent: n8n.ok,
      warn: n8n.warn || null
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
