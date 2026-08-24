# 🥥 Buka Kelapa App

Aplikasi input laporan produksi buka kelapa — data langsung tersimpan ke Excel OneDrive.

## Fitur
- 📱 Form input per shift (A/B/C) + Rekap Harian, mobile-friendly (PWA)
- ✍️ Data langsung ditulis ke Excel OneDrive via Microsoft Graph API
- 🔐 Login username/password dengan role Superadmin & Admin
- 📜 Audit log — siapa ubah apa, kapan
- 🔑 Ganti password sendiri; superadmin bisa reset password user lain
- 📊 Dashboard monitoring + grafik tren EF WM
- 🧮 Field formula (EF, Total) TIDAK ditimpa — tetap dihitung Excel

## Setup (sekali saja)

### 1. Supabase (database)
1. Daftar di https://supabase.com (gratis)
2. Buat project baru
3. Buka SQL Editor → paste isi `supabase-schema.sql` → Run
4. Catat dari Settings → API:
   - `Project URL` → SUPABASE_URL
   - `service_role key` → SUPABASE_SERVICE_KEY

### 2. Environment
1. Copy `.env.example` jadi `.env.local`
2. Isi semua nilai (Supabase + Microsoft credential yang sudah dicatat)

### 3. Jalankan lokal
```bash
npm install
npm run dev
```
Buka http://localhost:3000
Login pertama: username `angga` password `admin123` → **langsung ganti password!**

### 4. Hubungkan Microsoft (sekali saja, oleh owner)
1. Login sebagai superadmin
2. Buka http://localhost:3000/api/auth/ms/start
3. Login Microsoft & setujui izin
4. Selesai — refresh token tersimpan di database, app bisa tulis Excel selamanya

### 5. Deploy ke Vercel
1. Push project ke GitHub
2. Import di vercel.com
3. Isi semua Environment Variables (sama seperti .env.local, tapi:)
   - `MS_REDIRECT_URI` → https://NAMA-APP.vercel.app/api/auth/ms/callback
   - `APP_URL` → https://NAMA-APP.vercel.app
4. Tambahkan Redirect URI baru di Azure Portal:
   App Registration → Authentication → Add URI → https://NAMA-APP.vercel.app/api/auth/ms/callback
5. Deploy → ulangi step 4 (hubungkan Microsoft) di URL production

## Struktur Cell Excel (Sheet: Laporan SMS 2 (KG))
- Shift A = kolom D | Shift B = kolom M | Shift C = kolom S
- Rekap = kolom D baris 37-61
- PH Santan = kolom label (B/K/Q) baris 25-34
- Field EF & Total tidak ditulis app (formula Excel)
