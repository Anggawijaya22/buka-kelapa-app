# 🥥 Buka Kelapa App

Aplikasi input laporan produksi buka kelapa — data langsung tersimpan ke Excel OneDrive.

## Fitur
- Form input per shift (A/B/C) + Rekap Harian, mobile dan web (PWA)
- Data langsung ditulis ke Excel OneDrive via Microsoft Graph API
- Login username/password dengan role Superadmin & Admin
- Audit log — siapa ubah apa, kapan
- Ganti password sendiri; superadmin bisa reset password user lain
- Dashboard monitoring + grafik tren EF WM
- Field formula (EF, Total) TIDAK ditimpa — tetap dihitung Excel

## Struktur Cell Excel (Sheet: Laporan SMS 2 (KG))
- Shift A = kolom D | Shift B = kolom M | Shift C = kolom S
- Rekap = kolom D baris 37-61
- PH Santan = kolom label (B/K/Q) baris 25-34
- Field EF & Total tidak ditulis app (formula Excel)
