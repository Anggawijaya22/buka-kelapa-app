import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/logs?tanggal=YYYY-MM-DD — riwayat aktivitas semua user (login, ganti password, kelola
// user, input/edit data, dll), difilter per tanggal supaya tidak menumpuk. Tanpa ?tanggal, tampil
// semua (dibatasi 300 baris terbaru). Khusus Developer. Detail lengkap input data TIDAK ditampilkan
// di sini (sudah ada di menu Monitoring) — halaman /log cuma menampilkan ringkasan yang manusiawi.
export async function GET(req) {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const tanggal = searchParams.get('tanggal');

  let query = db
    .from('audit_logs')
    .select('id, username, action, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (tanggal) {
    query = query.gte('created_at', `${tanggal}T00:00:00.000Z`).lte('created_at', `${tanggal}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}
