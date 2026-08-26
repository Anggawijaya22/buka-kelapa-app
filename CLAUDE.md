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
- **Dashboard, Users, Pengaturan:** hanya Developer (superadmin)
- **Input Data:** Admin Shift (shift terbatas, tanpa Rekap Harian) + Admin Atas (hanya Rekap Harian) + Developer (semua)
- **History:** Admin Shift (hanya data shift miliknya sendiri, bisa edit) + Admin Atas (data shiftA/B/C + rekap, bisa edit semua) + Developer (semua, bisa edit semua)
- **Approval:** viewer + Developer
- **Password:** semua role
- **⬇️ Download Excel:** semua role (lihat "Download Excel" di bawah)

### Download Excel
- Link di Nav (`show: true` untuk semua role) → `GET /api/excel/download` (`src/app/api/excel/download/route.js`).
- Download file Excel OneDrive APA ADANYA (byte mentah lewat Graph API `/content`), bukan generate ulang —
  jadi hasil download = kondisi live sheet saat itu juga, termasuk isian yang belum diproses n8n.
  Nama file otomatis `Laporan-Produksi-<tanggal-hari-ini>.xlsx`.
- Fungsi Graph API: `downloadExcelFile()` di `src/lib/graph.js`, pakai `MS_FILE_ID` yang sama dengan
  fitur tulis Excel lainnya (`writeCell`/`readRange`).
- Tidak ada pembatasan role selain harus login (`requireAuth()` tanpa parameter role).

> ⚠️ Menu **History** yang SEKARANG berbeda total dari History versi lama (yang dulu isinya audit log,
> khusus Developer, sudah dihapus total termasuk `src/app/api/logs`). History versi baru ini adalah
> monitor+edit data submission per tanggal (lihat bagian "Menu History (Monitor & Edit)" di bawah).

### Form Input Data (validasi, draft, popup hasil)
- **Semua field wajib diisi** (termasuk 15 field PH Santan) sebelum submit bisa jalan — divalidasi oleh
  `validateProductionForm()` di `src/lib/ProductionFormFields.js`. Kalau ada yang kosong: submit diblokir
  (tidak sampai memanggil API), muncul pesan "Data belum lengkap", field yang kosong ditandai merah
  (class CSS `.field-error`) + ikon ⚠️ di labelnya. User harus isi 0 kalau memang tidak ada nilainya.
- **KgInput** (`src/lib/KgInput.js`) sekarang menerima **koma ATAU titik** sebagai pemisah desimal saat
  mengetik (keyboard angka HP Indonesia biasanya cuma punya tombol koma) — sebelumnya koma di-strip diam-
  diam sehingga "79.911,00" jadi "7.991.100" yang salah total. Tampilan saat fokus menunjukkan persis apa
  yang diketik user (termasuk komanya); setelah blur tetap diformat ribuan-titik/desimal-koma seperti biasa.
  Kontrak `onChange` tidak berubah — tetap raw dot-decimal ("79911.00") untuk kompatibilitas Excel.
- **Popup hasil submit**: `src/lib/useResultModal.js`, dipakai di submit Input Data, Simpan Perubahan
  History, dan tombol LIBUR PRODUKSI. Sukses → "✅ DATA BERHASIL DIKIRIM" + tombol OK (kembali ke
  menu/tutup, form/draft otomatis bersih). Gagal → "❌ DATA GAGAL DIKIRIM" + tombol "Kirim Ulang"
  (retry pakai payload yang sama) atau "Kembali" (tutup, data isian tetap ada, tidak hilang).
- **Draft otomatis + tombol Refresh**: HANYA di `/input/form` (input baru), TIDAK di History (edit).
  Form auto-save ke `localStorage` (key `bk_draft_<target>_<waktu>`) tiap kali user mengetik. Kalau
  HP/PC mati di tengah proses, buka lagi form yang sama → tombol "🔄 Refresh" muncul (kalau ada draft
  tersimpan) → klik untuk memuat ulang isian sebelumnya (ada konfirmasi supaya tidak menimpa isian baru
  yang sedang diketik tanpa sengaja). Draft dihapus otomatis setelah submit berhasil.

### Menu History (Monitor & Edit)
- Route: `/history`, API: `src/app/api/history/route.js` (GET = lihat, PUT = edit).
- Ada date picker (default hari ini). Data diambil dari tabel `submissions` (BUKAN dari Excel — Excel
  cuma snapshot "live" tanpa histori per tanggal, lihat catatan Excel di bawah).
- **Admin Shift:** hanya lihat & edit data shift yang ditugaskan ke dirinya (`target === session.shift`),
  tidak bisa lihat shift lain atau rekap.
- **Admin Atas & Developer:** lihat & edit shiftA/B/C + rekap, semua tanggal.
- Tanggal yang belum pernah ada submission-nya tampil "Belum ada data" — **tidak bisa diisi dari sini**,
  input pertama kali tetap wajib lewat menu Input Data.
- Edit MENIMPA payload submission yang sama (UPDATE, bukan INSERT baru) via `executeShiftEdit`/
  `executeRekapEdit` di `src/lib/submitFlow.js`. Field `tanggal`/`tanggalIso`/`waktu` tidak bisa diubah
  lewat edit (immutable per record).
- **Excel HANYA ditulis kalau tanggal yang diedit = hari ini** (`writeToExcel = existing.tanggal === todayIso()`).
  Edit ke tanggal lampau cuma update Supabase, Excel (laporan live) tidak disentuh — supaya edit data lama
  tidak menimpa laporan hari ini yang sedang dipakai n8n.
- Edit tetap trigger WA (sama seperti submit awal), tapi kena cooldown submit (lihat di bawah).

### Cooldown Submit (anti-spam WA)
- Berlaku untuk **Admin Shift & Admin Atas**, di SEMUA aksi yang trigger WA: submit awal (`api/shift`,
  `api/rekap`), submit anomali (`api/approvals` POST), kirim notif libur (`api/libur`), dan edit History
  (`api/history` PUT). **Developer (superadmin) tidak kena cooldown.**
- Per-user (bukan per-record): begitu 1 aksi submit berhasil, user itu harus tunggu N menit sebelum bisa
  submit aksi APA PUN lagi. Dilacak lewat kolom `users.last_submit_at`, dicek/di-update oleh
  `src/lib/cooldown.js` (`checkCooldown`, `markSubmitted`).
- Durasi default **3 menit**, disimpan di tabel `app_settings` (key `submit_cooldown_minutes`), bisa
  diubah Developer lewat menu **Pengaturan** (`/pengaturan`, API `src/app/api/settings/route.js`) tanpa
  perlu ubah kode.
- UI: hitung mundur ditampilkan via hook `src/lib/useCooldown.js` + komponen `src/lib/CooldownNotice.js`,
  dipakai di halaman Input Data dan History. Tombol submit/simpan otomatis ke-disable selama cooldown.

### Notifikasi WhatsApp
- Laporan WA dikirim saat admin **submit** (webhook trigger ke n8n) — termasuk saat edit lewat History
- Rekap harian: manual trigger
- Tombol "LIBUR PRODUKSI" di app → kirim notif langsung ke bos
- Semua aksi WA di atas kena Cooldown Submit (lihat di atas)

---

## Database Schema (Tabel Utama)

### `users`
```sql
id, username, password_hash, role ('superadmin'|'admin'|'admin_atas'|'viewer'),
shift ('shiftA'|'shiftB'|'shiftC'|null),   -- wajib utk admin, null utk role lain
last_submit_at timestamptz,                -- dasar cooldown submit, lihat Cooldown Submit
created_at, updated_at
```

### `submissions`
```sql
id bigint identity, user_id (→ users.id ON DELETE SET NULL), username text,
target text ('shiftA'|'shiftB'|'shiftC'|'rekap'),   -- 'waktu' pagi/siang/malam ada DI DALAM payload, bukan kolom sendiri
tanggal date, payload jsonb,                         -- payload = seluruh isi form yang disubmit (sumber histori)
edited_at timestamptz, edited_by_id (→ users.id ON DELETE SET NULL), edited_by_username text,
created_at timestamptz
```
> Tidak ada unique constraint di `(target, tanggal)` — bisa ada beberapa baris kalau pernah disubmit
> ulang; "data terkini" = baris dengan `created_at` terbaru per target+tanggal (lihat `api/history` GET).

### `app_settings`
```sql
key text primary key, value text, updated_at timestamptz
```
Key-value pengaturan aplikasi. Saat ini cuma dipakai untuk `submit_cooldown_minutes` (default `'3'`).

### `audit_logs`
```sql
id, user_id (→ users.id ON DELETE SET NULL),
action, detail jsonb, created_at
```

> ⚠️ **FK constraint:** `audit_logs.user_id` dan `submissions.user_id` pakai `ON DELETE SET NULL`
> (sudah dimigrasi — hapus user tidak akan gagal, log tetap ada dengan user_id null)

> ⚠️ **Excel bukan buku besar per-tanggal.** Sheet "Laporan SMS 2 (KG)" cuma punya 1 baris/kolom
> "live" per shift (misal Shift A selalu kolom D baris 5-34, apa pun tanggalnya) — bukan 1 baris per
> tanggal. Jadi histori yang akurat per tanggal HANYA ada di `submissions.payload`, bukan di Excel.
> Ini alasan menu History baca dari Supabase, dan kenapa edit tanggal lampau tidak boleh menulis ke Excel.

---

## Migrasi SQL — Status

| File | Status |
|------|--------|
| `migration-admin-shift.sql` | ✅ SUDAH dijalankan (kolom `shift` di tabel `users`) |
| `migration-fix-delete-user.sql` | ✅ SUDAH dijalankan (FK ON DELETE SET NULL untuk audit_logs & submissions) |
| `add_admin_atas_role` (via MCP, tanpa file lokal) | ✅ SUDAH dijalankan (`users_role_check` diperluas untuk mengizinkan `admin_atas`) |
| `add_history_edit_and_cooldown_support` (via MCP, tanpa file lokal) | ✅ SUDAH dijalankan (tabel `app_settings`, kolom `users.last_submit_at`, kolom `submissions.edited_at`/`edited_by_id`/`edited_by_username`) |

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
│   │   ├── shift/        ← validasi shift admin server-side + cooldown
│   │   ├── rekap/        ← khusus admin_atas/superadmin + cooldown
│   │   ├── approvals/    ← validasi shift admin server-side + cooldown
│   │   ├── libur/        ← validasi shift admin server-side + cooldown
│   │   ├── history/      ← GET (lihat) & PUT (edit) submission lama, dipakai menu History
│   │   ├── settings/     ← GET/PUT pengaturan (cooldown minutes), PUT khusus superadmin
│   │   ├── cooldown/     ← GET sisa cooldown user yang login, dipakai init hitung mundur di client
│   │   └── users/        ← route.js sudah fix silent fail delete
│   ├── history/          ← menu History (monitor & edit submission per tanggal)
│   ├── pengaturan/       ← menu Pengaturan (khusus Developer)
│   └── (pages lain)/
├── src/lib/
│   ├── submitFlow.js             ← executeShiftSubmit/executeRekapSubmit (insert baru) +
│   │                                executeShiftEdit/executeRekapEdit (update History)
│   ├── ProductionFormFields.js   ← field form shift/rekap, dipakai bareng Input Data & History
│   ├── cooldown.js, settings.js  ← logic cooldown submit & pengaturan
│   ├── useCooldown.js, CooldownNotice.js ← hook + komponen UI hitung mundur
│   ├── useResultModal.js         ← popup "DATA BERHASIL/GAGAL DIKIRIM" (OK / Kirim Ulang / Kembali)
│   └── KgInput.js                ← input angka format ID, terima koma ATAU titik sbg desimal
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
