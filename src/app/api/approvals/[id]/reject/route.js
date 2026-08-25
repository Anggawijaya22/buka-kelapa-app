import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';

const APPROVER_ROLES = ['viewer', 'superadmin'];

export async function POST(req, { params }) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!APPROVER_ROLES.includes(auth.session.role)) {
    return NextResponse.json({ error: 'Hanya Viewer/Superadmin yang boleh Reject' }, { status: 403 });
  }

  const id = Number(params.id);

  const { data: claimed, error: claimError } = await db
    .from('pending_approvals')
    .update({ status: 'rejected', resolved_by_username: auth.session.username, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  if (!claimed) {
    const { data: current } = await db.from('pending_approvals').select('status, resolved_by_username').eq('id', id).single();
    return NextResponse.json({
      error: current?.status === 'approved'
        ? `Sudah di-ACC oleh ${current.resolved_by_username}`
        : current?.status === 'rejected'
          ? `Sudah di-Reject oleh ${current.resolved_by_username}`
          : 'Data tidak ditemukan'
    }, { status: 409 });
  }

  await logAudit(auth.session, 'REJECT_ANOMALI', { target: claimed.target, tanggal: claimed.tanggal, submittedBy: claimed.submitted_by_username });

  return NextResponse.json({ ok: true });
}
