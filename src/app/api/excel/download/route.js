import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { downloadExcelFile } from '@/lib/graph';

// Download file Excel (OneDrive) apa adanya — dibuka untuk SEMUA role yang login.
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const buffer = await downloadExcelFile();
    const tanggal = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Laporan-Produksi-${tanggal}.xlsx"`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
