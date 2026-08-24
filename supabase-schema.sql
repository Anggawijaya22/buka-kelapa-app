-- ============================================
-- SCHEMA DATABASE — BUKA KELAPA APP
-- Jalankan di Supabase SQL Editor
-- ============================================

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'admin' check (role in ('superadmin','admin')),
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references users(id),
  username text,
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

create table if not exists ms_tokens (
  id int primary key default 1,
  refresh_token text not null,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

create table if not exists submissions (
  id bigint generated always as identity primary key,
  user_id uuid references users(id),
  username text,
  target text not null,          -- 'shiftA' | 'shiftB' | 'shiftC' | 'rekap'
  tanggal date not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- User superadmin pertama (password: admin123 — GANTI SETELAH LOGIN PERTAMA)
-- Hash dibawah = bcrypt('admin123')
insert into users (username, password_hash, role)
values ('angga', '$2a$10$dHR2YYMSy3FmSlS0xDOboeLueJLo2S7UlN7OqNAxP2Zc0aKWGQ6Lu', 'superadmin')
on conflict (username) do nothing;
