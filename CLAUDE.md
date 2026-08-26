# Buka Kelapa App — Project Memory

## ⚠️ Project Identity (Baca Ini Dulu)
- **Nama project:** Buka Kelapa App
- **Folder lokal:** `C:\buka-kelapa-app`
- **Supabase project ref:** `nrfbvhqjzfngyozduocw`
- **Supabase URL:** `https://nrfbvhqjzfngyozduocw.supabase.co`
- **Region:** ap-southeast-1 (Singapore)
- **Status:** ACTIVE_HEALTHY
- **Postgres:** 17.6.1.155
- **Dibuat:** 2026-08-24
- **Org:** Anggawijaya22's Org (FREE plan)
- **Jangan confused dengan:** BPI Access Card (ref: `zykejyyjbjwhtoksbtpp`, project & org berbeda)
- **Saat sesi baru:** jalankan `list_projects` → pastikan `nrfbvhqjzfngyozduocw` muncul dan ACTIVE_HEALTHY

---

## Stack Teknologi
| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14 (App Router), PWA |
| Backend | Next.js API Routes (`/src/app/api/`) |
| Database | Supabase PostgreSQL (Singapore) |
| Auth | Custom username/password (bukan Supabase Auth) |
| File output | Microsoft Graph API → OneDrive Excel |
| Hosting | Vercel |
| Runtime | Node.js v24 |

---

## Tujuan Aplikasi
Aplikasi input shift produksi kelapa untuk 3 admin shift + 1 superadmin (Developer).
Admin input data langsung dari HP → tulis ke Excel OneDrive → n8n baca Excel → kirim laporan WhatsApp.

---

## Struktur Role User

| Role DB | Label UI | Akses |
|---------|----------|-------|
| `superadmin` | **Developer** | Semua fitur + Users management |
| `admin` | Admin Shift | Input Data shift (A/B/C, sesuai shift yang ditugaskan) + Password. **Tidak** ada akses Rekap Harian. |
| `admin_atas` | Admin Atas | Input Data — hanya Rekap Harian (gabungan 3 shift) + Password. Tidak punya kolom `shift` (null). |
| `viewer` | Viewer | Approval (lihat) + Password |

> ⚠️ **Penting:** Value di database tetap `superadmin` / `admin` / `admin_atas` / `viewer`.
> Label "Developer"/"Admin Shift"/"Admin Atas" di UI hanya tampilan — jangan ubah value DB.
> Constraint `users_role_check` sudah dimigrasi untuk mengizinkan `admin_atas` (lihat migrasi `add_admin_atas_role`).

---

## Aturan Bisnis Kritis

### Shift
- Shift A / B / C **berotasi** — tidak terikat waktu tetap
- Admin Shift (`admin`) hanya bisa input untuk **1 shift yang ditugaskan** (kolom `shift` di tabel `users`)
- Superadmin/Developer bebas semua shift
- Pembatasan ditegakkan di **server-side** (`api/shift`, `api/approvals`, `api/libur`) — bukan cuma UI

### Rekap Harian
- Rekap Harian (gabungan 3 shift) **hanya tugas Admin Atas** (`admin_atas`) — dan Developer (superadmin).
- Admin Shift (`admin`) **tidak** melihat/bisa submit Rekap Harian (dihapus dari UI `/input` dan diblokir di `api/rekap`, `api/libur` target=rekap, `api/approvals` isRekap).
- Admin Atas tidak punya kolom `shift` (selalu null) dan tidak bisa input data shift (diblokir di `api/shift`, `api/libur` non-rekap, `api/approvals` non-rekap).

### Menu per Role
- **Dashboard, History, Users:** hanya Developer (superadmin)
- **Input Data:** Admin Shift (shift terbatas, tanpa Rekap Harian) + Admin Atas (hanya Rekap Harian) + Developer (semua)
- **Approval:** viewer + Developer
- **Password:** semua role

### Notifikasi WhatsApp
- Laporan WA dikirim saat admin **submit** (webhook trigger ke n8n)
- Rekap harian: manual trigger
- Tombol "LIBUR PRODUKSI" di app → kirim notif langsung ke bos

---

## Database Schema (Tabel Utama)

### `users`
```sql
id, username, password_hash, role ('superadmin'|'admin'|'viewer'),
shift ('A'|'B'|'C'|null),   -- null = superadmin/viewer, wajib untuk admin
created_at, updated_at
```

### `submissions`
```sql
id, user_id (→ users.id ON DELETE SET NULL),
shift, waktu ('pagi'|'siang'|'malam'),
data jsonb, created_at
```

### `audit_logs`
```sql
id, user_id (→ users.id ON DELETE SET NULL),
action, detail jsonb, created_at
```

> ⚠️ **FK constraint:** `audit_logs.user_id` dan `submissions.user_id` pakai `ON DELETE SET NULL`
> (sudah dimigrasi — hapus user tidak akan gagal, log tetap ada dengan user_id null)

---

## Migrasi SQL — Status

| File | Status |
|------|--------|
| `migration-admin-shift.sql` | ✅ SUDAH dijalankan (kolom `shift` di tabel `users`) |
| `migration-fix-delete-user.sql` | ✅ SUDAH dijalankan (FK ON DELETE SET NULL untuk audit_logs & submissions) |
| `add_admin_atas_role` (via MCP, tanpa file lokal) | ✅ SUDAH dijalankan (`users_role_check` diperluas untuk mengizinkan `admin_atas`) |

> Untuk migrasi berikutnya: **gunakan Supabase MCP `apply_migration`** — tidak perlu copy-paste ke SQL Editor manual.

---

## Integrasi Microsoft Graph API
- Azure App Registration: **BukaKelapa-App**
- Permission: `Files.ReadWrite`
- Target: file Excel di OneDrive yang sama dengan yang dibaca n8n
- Credentials: lihat `.env.local` (jangan di-commit)

---

## Environment Variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://nrfbvhqjzfngyozduocw.supabase.co   # ✅ confirmed
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
ONEDRIVE_FILE_ID=...
```

---

## Git & Deployment
- Branch utama: `main`
- Hosting: Vercel (auto-deploy dari main)
- Commit terakhir yang relevan:
  - `8a71a8d` — pembatasan shift per admin + fix menu per role
  - `77b21df` — ganti label "Superadmin" → "Developer" di UI

---

## Struktur Folder Penting
```
C:\buka-kelapa-app\
├── src/app/
│   ├── api/
│   │   ├── shift/        ← validasi shift admin server-side
│   │   ├── approvals/    ← validasi shift admin server-side
│   │   ├── libur/        ← validasi shift admin server-side
│   │   └── users/        ← route.js sudah fix silent fail delete
│   └── (pages)/
├── .env.local            ← credentials (jangan commit)
├── .mcp.json             ← Supabase MCP config (ref nrfbvhqjzfngyozduocw)
├── migration-admin-shift.sql        ← sudah dijalankan
├── migration-fix-delete-user.sql    ← sudah dijalankan
└── CLAUDE.md             ← file ini
```

---

## Catatan Sesi Sebelumnya
- Supabase MCP disambungkan via `.mcp.json` di root project
- Fix hapus user: dulu silent fail karena FK tanpa `ON DELETE SET NULL` dan API tidak cek error dari `delete()` → sudah diperbaiki di `src/app/api/users/route.js` dan di DB via migrasi
- n8n trigger diubah dari schedule → webhook (karena shift tidak terikat waktu tetap)
