-- Migration: perbaiki bug hapus user (delete gagal diam-diam karena FK constraint)
-- Jalankan di Supabase SQL Editor
-- Riwayat audit_logs & submissions tetap tersimpan (username teks tidak hilang),
-- hanya user_id-nya jadi NULL kalau user aslinya dihapus.

alter table audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table audit_logs add constraint audit_logs_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

alter table submissions drop constraint if exists submissions_user_id_fkey;
alter table submissions add constraint submissions_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;
