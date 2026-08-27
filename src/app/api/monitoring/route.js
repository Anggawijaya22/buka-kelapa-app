import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { todayIso } from '@/lib/date';
import { executeShiftEdit, executeRekapEdit } from '@/lib/submitFlow';
import { checkCooldown, markSubmitted } from '@/lib/cooldown';
import { getCooldownMinutes } from '@/lib/settings';

const ALL_TARGETS = ['shiftA', 'shiftB', 'shiftC', 'rekap'];

// GET /api/monitoring?tanggal=YYYY-MM-DD  (default: hari ini)
// Admin Shift  -> hanya data shift yang ditugaskan ke dirinya
// Admin Atas / Developer -> data shiftA, shiftB, shiftC, dan rekap
export async function GET(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'admin_atas', 'superadmin'].includes(auth.session.role)) {
    return NextResponse.json({ error: 'Anda tidak punya akses ke Monitoring' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tanggal = searchParams.get('tanggal') || todayIso();

  let targets;
  if (auth.session.role === 'admin') {
    if (!auth.session.shift) {
      return NextResponse.json({ error: 'Shift Anda belum diset. Hubungi developer.' }, { status: 403 });
    }
    targets = [auth.session.shift];
  } else {
    targets = ALL_TARGETS;
  }

  const { data, error } = await db
    .from('submissions')
    .select('id, target, tanggal, username, payload, created_at, edited_at, edited_by_username')
    .eq('tanggal', tanggal)
    .in('target', targets)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bisa ada beberapa baris per target (kalau pernah disubmit ulang) — ambil yang terbaru saja
  const latestByTarget = {};
  for (const row of data) {
    if (!latestByTarget[row.target]) latestByTarget[row.target] = row;
  }

  const items = targets.map(t => latestByTarget[t] || { target: t, id: null });
  return NextResponse.json({ tanggal, items });
}

// PUT /api/monitoring { id, form } -> edit submission yang sudah ada (timpa payload yang sama)
export async function PUT(req) {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['admin', 'admin_atas', 'superadmin'].includes(auth.session.role)) {
    return NextResponse.json({ error: 'Anda tidak punya akses untuk edit Monitoring' }, { status: 403 });
  }

  const { id, form } = await req.json();
  if (!id || !form) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

  const { data: existing, error: fetchErr } = await db.from('submissions').select('*').eq('id', id).maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });

  const isRekap = existing.target === 'rekap';

  if (auth.session.role === 'admin' && (isRekap || existing.target !== auth.session.shift)) {
    return NextResponse.json({ error: 'Anda hanya bisa edit data shift Anda sendiri' }, { status: 403 });
  }
  // admin_atas & superadmin boleh edit target apa saja (shiftA/B/C/rekap)

  const cd = await checkCooldown(auth.session);
  if (!cd.ok) {
    return NextResponse.json({ error: `Tunggu ${cd.remainingSeconds} detik lagi sebelum submit berikutnya`, cooldownRemainingSeconds: cd.remainingSeconds }, { status: 429 });
  }

  // Tanggal/waktu record tidak boleh diubah lewat edit — hanya field data yang dipakai
  const { tanggal: _t, tanggalIso: _ti, waktu: _w, ...editableFields } = form;
  const mergedPayload = { ...existing.payload, ...editableFields };
  const writeToExcel = existing.tanggal === todayIso();

  try {
    const result = isRekap
      ? await executeRekapEdit({ id, mergedPayload, actorSession: auth.session, writeToExcel })
      : await executeShiftEdit({ id, target: existing.target, waktu: existing.payload?.waktu, mergedPayload, actorSession: auth.session, writeToExcel });

    await markSubmitted(auth.session.id);
    const cooldownMinutes = await getCooldownMinutes();
    return NextResponse.json({ ok: true, ...result, cooldownSeconds: cooldownMinutes * 60 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
