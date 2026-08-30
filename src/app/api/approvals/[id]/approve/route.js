import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';
import { executeShiftSubmit, executeRekapSubmit, executeShiftEdit, executeRekapEdit } from '@/lib/submitFlow';
import { todayIso } from '@/lib/date';
import { MAX_SEND_COUNT } from '@/lib/limits';

const APPROVER_ROLES = ['viewer', 'superadmin'];

export async function POST(req, { params }) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!APPROVER_ROLES.includes(auth.session.role)) {
    return NextResponse.json({ error: 'Hanya Viewer/Developer yang boleh ACC' }, { status: 403 });
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
    let result;

    if (claimed.submission_id) {
      // Ini pengajuan EDIT (data disimpan/dikirim dulu, lalu diedit ulang lewat Monitoring dan
      // ternyata anomali) — bukan submission baru. Timpa payload record yang sama, jangan insert baru.
      const { data: existing, error: existErr } = await db.from('submissions').select('*').eq('id', claimed.submission_id).maybeSingle();
      if (existErr) throw new Error(existErr.message);
      if (!existing) throw new Error('Data asli yang diedit sudah tidak ditemukan (mungkin sudah dihapus).');
      if (existing.status === 'sent' && existing.send_count >= MAX_SEND_COUNT) {
        throw new Error(`Data ini sudah dikirim ${MAX_SEND_COUNT}x dan terkunci sejak pengajuan ini dibuat — tidak bisa di-ACC lagi.`);
      }

      const writeToExcel = existing.tanggal === todayIso();
      const sendCount = (existing.send_count || 0) + 1;

      result = claimed.target === 'rekap'
        ? await executeRekapEdit({ id: existing.id, mergedPayload: form, actorSession, writeToExcel, send: true, sendCount })
        : await executeShiftEdit({ id: existing.id, target: claimed.target, waktu: existing.payload?.waktu, mergedPayload: form, actorSession, writeToExcel, send: true, sendCount });
    } else {
      result = claimed.target === 'rekap'
        ? await executeRekapSubmit({ form, actorSession, actionLabel: 'SUBMIT_REKAP_ACC' })
        : await executeShiftSubmit({ target: claimed.target, waktu: claimed.waktu, form, actorSession, actionLabel: 'SUBMIT_' + claimed.target.toUpperCase() + '_ACC' });
    }

    await db.from('pending_approvals').update({
      cells_written: result.cellsWritten,
      wa_sent: result.waSent
    }).eq('id', id);

    await logAudit(auth.session, 'ACC_ANOMALI', { target: claimed.target, tanggal: claimed.tanggal, submittedBy: claimed.submitted_by_username, edit: !!claimed.submission_id });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // Excel/n8n gagal setelah diklaim — catat errornya, status tetap 'approved' (sudah diputuskan),
    // tapi tandai error supaya admin/viewer tahu perlu tindak lanjut manual.
    await db.from('pending_approvals').update({ error_message: e.message }).eq('id', id);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
