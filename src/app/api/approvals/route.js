import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, logAudit } from '@/lib/db';
import { SHIFT_LABELS } from '@/lib/excel-map';
import { triggerN8n } from '@/lib/n8n';
import { checkCooldown, markSubmitted } from '@/lib/cooldown';
import { getCooldownMinutes } from '@/lib/settings';

const APPROVER_ROLES = ['viewer', 'superadmin'];

function targetLabelWA(target, waktu) {
  if (target === 'rekap') return 'Rekap Harian';
  return `${SHIFT_LABELS[target] || target}${waktu ? ' (' + waktu.toUpperCase() + ')' : ''}`;
}

// GET /api/approvals            -> daftar pending (utk viewer/superadmin, layar approval)
// GET /api/approvals?mine=true  -> riwayat pengajuan milik admin yang login (utk banner status di /input)
export async function GET(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get('mine') === 'true';

  if (mine) {
    const { data, error } = await db
      .from('pending_approvals')
      .select('*')
      .eq('submitted_by_id', auth.session.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data });
  }

  if (!APPROVER_ROLES.includes(auth.session.role)) {
    return NextResponse.json({ error: 'Hanya Viewer/Developer yang boleh melihat daftar approval' }, { status: 403 });
  }
  const { data, error } = await db
    .from('pending_approvals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

// POST /api/approvals -> admin mengajukan data anomali untuk di-ACC
export async function POST(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { target, waktu, form, efWmPreview, reason } = await req.json();
  const isRekap = target === 'rekap';
  if (!isRekap && !SHIFT_LABELS[target]) {
    return NextResponse.json({ error: 'Target tidak valid' }, { status: 400 });
  }
  if (!form?.tanggal) {
    return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 });
  }

  if (isRekap) {
    if (!['admin_atas', 'superadmin'].includes(auth.session.role)) {
      return NextResponse.json({ error: 'Hanya Admin Atas/Developer yang bisa input rekap harian' }, { status: 403 });
    }
  } else {
    if (!['admin', 'superadmin'].includes(auth.session.role)) {
      return NextResponse.json({ error: 'Anda tidak punya akses untuk input data shift' }, { status: 403 });
    }
    if (auth.session.role === 'admin') {
      if (!auth.session.shift) {
        return NextResponse.json({ error: 'Shift Anda belum diset. Hubungi developer.' }, { status: 403 });
      }
      if (auth.session.shift !== target) {
        return NextResponse.json({ error: 'Anda hanya bisa input data untuk shift yang ditugaskan' }, { status: 403 });
      }
    }
  }

  const cd = await checkCooldown(auth.session);
  if (!cd.ok) {
    return NextResponse.json({ error: `Tunggu ${cd.remainingSeconds} detik lagi sebelum submit berikutnya`, cooldownRemainingSeconds: cd.remainingSeconds }, { status: 429 });
  }

  const { data, error } = await db.from('pending_approvals').insert({
    target,
    waktu: waktu || null,
    tanggal: form.tanggal,
    form_payload: form,
    ef_wm_preview: efWmPreview ?? null,
    anomali_reason: reason || null,
    submitted_by_id: auth.session.id,
    submitted_by_username: auth.session.username,
    status: 'pending'
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(auth.session, 'AJUKAN_ANOMALI', { target, waktu, tanggal: form.tanggal, reason });

  // Kirim notifikasi WA ke Viewer via webhook n8n khusus anomali — tetap jalan walau viewer
  // sedang tidak buka aplikasi / logout. Tidak menggagalkan alur approval kalau webhook gagal.
  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_ANOMALI, {
    id: data.id,
    target,
    waktu: waktu || null,
    tanggal: form.tanggal,
    label: targetLabelWA(target, waktu),
    submittedBy: auth.session.username,
    efWm: efWmPreview ?? null,
    reason: reason || null,
    approvalUrl: `${process.env.APP_URL || ''}/approval`
  });

  await markSubmitted(auth.session.id);
  const cooldownMinutes = await getCooldownMinutes();
  return NextResponse.json({ ok: true, id: data.id, waSent: n8n.ok, warn: n8n.warn || null, cooldownSeconds: cooldownMinutes * 60 });
}
