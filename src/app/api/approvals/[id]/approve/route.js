import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';
import { executeShiftSubmit, executeRekapSubmit } from '@/lib/submitFlow';

const APPROVER_ROLES = ['viewer', 'superadmin'];

export async function POST(req, { params }) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!APPROVER_ROLES.includes(auth.session.role)) {
    return NextResponse.json({ error: 'Hanya Viewer/Superadmin yang boleh ACC' }, { status: 403 });
  }

  const id = Number(params.id);

  // Klaim atomik: hanya berhasil kalau status MASIH 'pending'.
  // Kalau 2 viewer klik bersamaan, database menjamin hanya 1 yang menang — sisanya dapat 0 baris ter-update.
  const { data: claimed, error: claimError } = await db
    .from('pending_approvals')
    .update({ status: 'approved', resolved_by_username: auth.session.username, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  if (!claimed) {
    // Sudah lebih dulu diproses orang lain — beri tahu siapa
    const { data: current } = await db.from('pending_approvals').select('status, resolved_by_username').eq('id', id).single();
    return NextResponse.json({
      error: current?.status === 'approved'
        ? `Sudah di-ACC oleh ${current.resolved_by_username}`
        : current?.status === 'rejected'
          ? `Sudah di-Reject oleh ${current.resolved_by_username}`
          : 'Data tidak ditemukan'
    }, { status: 409 });
  }

  try {
    const actorSession = { id: claimed.submitted_by_id, username: claimed.submitted_by_username };
    const form = claimed.form_payload;

    const result = claimed.target === 'rekap'
      ? await executeRekapSubmit({ form, actorSession, actionLabel: 'SUBMIT_REKAP_ACC' })
      : await executeShiftSubmit({ target: claimed.target, waktu: claimed.waktu, form, actorSession, actionLabel: 'SUBMIT_' + claimed.target.toUpperCase() + '_ACC' });

    await db.from('pending_approvals').update({
      cells_written: result.cellsWritten,
      wa_sent: result.waSent
    }).eq('id', id);

    await logAudit(auth.session, 'ACC_ANOMALI', { target: claimed.target, tanggal: claimed.tanggal, submittedBy: claimed.submitted_by_username });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // Excel/n8n gagal setelah diklaim — catat errornya, status tetap 'approved' (sudah diputuskan),
    // tapi tandai error supaya admin/viewer tahu perlu tindak lanjut manual.
    await db.from('pending_approvals').update({ error_message: e.message }).eq('id', id);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
