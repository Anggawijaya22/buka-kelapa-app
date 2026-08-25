-- Tabel untuk data anomali yang menunggu ACC/Reject dari Viewer/Superadmin
create table if not exists pending_approvals (
  id bigserial primary key,
  target text not null,                     -- 'shiftA' | 'shiftB' | 'shiftC' | 'rekap'
  waktu text,                                -- 'pagi' | 'siang' | 'malam' (null utk rekap)
  tanggal text,                              -- tanggal display, mis. "25/08/26"
  form_payload jsonb not null,               -- payload lengkap yg akan ditulis ke Excel saat di-ACC
  ef_wm_preview numeric,                     -- nilai EF WM yang terdeteksi anomali
  anomali_reason text,                       -- alasan anomali ditampilkan ke viewer
  submitted_by_id uuid,
  submitted_by_username text,
  status text not null default 'pending',    -- pending | approved | rejected
  resolved_by_username text,
  resolved_at timestamptz,
  cells_written integer,
  wa_sent boolean,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_approvals_status on pending_approvals(status);
create index if not exists idx_pending_approvals_submitted_by on pending_approvals(submitted_by_id);
