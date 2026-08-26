import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { readRange } from '@/lib/graph';

export async function GET() {
  // Catatan: endpoint ini juga dipakai internal oleh form input (cek anomali EF WM
  // rekap sebelum submit), jadi tetap terbuka untuk semua role yang login — bukan
  // hanya superadmin. Pembatasan menu "Dashboard" khusus superadmin dilakukan di
  // level halaman (src/app/dashboard/page.js) dan Nav, bukan di API ini.
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    // Baca data live dari Excel: EF WM per shift (row 16) + rekap (row 48)
    const { text } = await readRange('A1:V100');

    const efShiftA = text?.[15]?.[3]  || '-';
    const efShiftB = text?.[15]?.[12] || '-';
    const efShiftC = text?.[15]?.[18] || '-';
    const efRekap  = text?.[47]?.[3]  || '-';
    const tglA = text?.[4]?.[3]  || '-';
    const tglB = text?.[4]?.[12] || '-';
    const tglC = text?.[4]?.[18] || '-';
    const tglRekap = text?.[36]?.[3] || '-';
    const bkA = text?.[5]?.[3]  || '-';
    const bkB = text?.[5]?.[12] || '-';
    const bkC = text?.[5]?.[18] || '-';

    // History EF WM dari submissions (untuk grafik tren)
    const { data: history } = await db
      .from('submissions')
      .select('target, tanggal, payload, created_at')
      .order('tanggal', { ascending: true })
      .limit(90);

    const trend = (history || [])
      .filter(s => s.target !== 'rekap' && s.payload?.kgWm && s.payload?.bkKlp)
      .map(s => ({
        tanggal: s.tanggal,
        target: s.target,
        efWm: Number((Number(String(s.payload.kgWm).replace(',', '.')) / Number(String(s.payload.bkKlp).replace(',', '.'))).toFixed(4))
      }))
      .filter(t => isFinite(t.efWm));

    return NextResponse.json({
      live: {
        shiftA: { tanggal: tglA, bkKlp: bkA, efWm: efShiftA },
        shiftB: { tanggal: tglB, bkKlp: bkB, efWm: efShiftB },
        shiftC: { tanggal: tglC, bkKlp: bkC, efWm: efShiftC },
        rekap:  { tanggal: tglRekap, efWm: efRekap }
      },
      trend
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
