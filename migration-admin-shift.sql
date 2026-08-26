-- Migration: tambah kolom shift untuk membatasi admin hanya bisa input shift tertentu
-- Jalankan di Supabase SQL Editor
alter table users add column if not exists shift text check (shift in ('shiftA','shiftB','shiftC'));

-- Admin yang sudah ada akan punya shift = NULL (belum diset).
-- Superadmin harus assign shift A/B/C untuk tiap admin lewat menu Users
-- sebelum admin tsb bisa input data lagi.
