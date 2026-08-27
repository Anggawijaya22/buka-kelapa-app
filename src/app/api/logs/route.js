import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/logs — riwayat aktivitas semua user (login, ganti password, kelola user, input/edit data, dll).
// Khusus Developer. Detail lengkap input data TIDAK ditampilkan di sini (sudah ada di menu Monitoring) —
// halaman /log cuma menampilkan ringkasan yang manusiawi.
export async function GET() {
  const auth = await requireAuth('superadmin');
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await db
    .from('audit_logs')
    .select('id, username, action, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}
