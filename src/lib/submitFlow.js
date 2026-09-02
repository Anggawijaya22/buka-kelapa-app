import { buildShiftCellMap, buildRekapCellMap, buildShiftLiburCellMap } from './excel-map';
import { writeCells, writeCellsForce } from './graph';
import { triggerN8n } from './n8n';
import { db, logAudit } from './db';

// "DD/MM/YYYY" (format tampilan dipakai n8n) -> "DD/MM/YY" (format 2 digit tahun dipakai kolom
// Tanggal di Excel, konsisten dengan toExcelDate() di form submit biasa).
function toExcelYearShort(displayDate) {
  const parts = String(displayDate).split('/');
  if (parts.length !== 3) return displayDate;
  const [d, m, y] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
}

// Eksekusi tulis Excel + trigger n8n untuk SHIFT.
// actorSession = pemilik data (admin yang submit awal) — dipakai untuk submissions & audit log,
// supaya riwayat tetap tercatat atas nama admin walau eksekusinya dipicu oleh ACC viewer.
// mode 'draft' (dari tombol "Simpan") HANYA insert ke Supabase — TIDAK menulis Excel/webhook,
// supaya admin bisa simpan dulu, cek lagi, baru "Kirim Data" belakangan dari Monitoring.
export async function executeShiftSubmit({ target, waktu, form, actorSession, actionLabel, mode = 'sent' }) {
  const isDraft = mode === 'draft';

  let written = [];
  let n8n = { ok: false, warn: null };
  if (!isDraft) {
    const cellMap = buildShiftCellMap(target, form, waktu);
    written = await writeCells(cellMap);
    n8n = await triggerN8n(process.env.N8N_WEBHOOK_SHIFT, { target, waktu, tanggal: form.tanggal });
  }

  await db.from('submissions').insert({
    user_id: actorSession.id,
    username: actorSession.username,
    target,
    tanggal: form.tanggalIso || null,
    payload: { ...form, waktu },
    status: isDraft ? 'draft' : 'sent',
    send_count: isDraft ? 0 : 1
  });
  await logAudit(actorSession, actionLabel || ((isDraft ? 'SIMPAN_' : 'SUBMIT_') + target.toUpperCase()), { tanggal: form.tanggal, waktu, cells: written.length });

  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null, isDraft };
}

// Eksekusi tulis Excel + trigger n8n untuk REKAP. Lihat catatan mode 'draft' di atas.
export async function executeRekapSubmit({ form, actorSession, actionLabel, mode = 'sent' }) {
  const isDraft = mode === 'draft';

  let written = [];
  let n8n = { ok: false, warn: null };
  if (!isDraft) {
    const cellMap = buildRekapCellMap(form);
    written = await writeCells(cellMap);
    n8n = await triggerN8n(process.env.N8N_WEBHOOK_REKAP, { tanggal: form.tanggal });
  }

  await db.from('submissions').insert({
    user_id: actorSession.id,
    username: actorSession.username,
    target: 'rekap',
    tanggal: form.tanggalIso || null,
    payload: form,
    status: isDraft ? 'draft' : 'sent',
    send_count: isDraft ? 0 : 1
  });
  await logAudit(actorSession, actionLabel || (isDraft ? 'SIMPAN_REKAP' : 'SUBMIT_REKAP'), { tanggal: form.tanggal, cells: written.length });

  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null, isDraft };
}

// Edit data SHIFT lama lewat menu Monitoring — menimpa payload submission yang sama (bukan insert baru).
// send=false: HANYA update payload, tetap berstatus draft, tidak menyentuh Excel/webhook/hitungan kirim
//   (dipakai tombol "Simpan" saat mengedit draft yang belum pernah dikirim).
// send=true: kirim beneran — update payload + tulis Excel (kalau writeToExcel) + webhook + send_count+1
//   + status jadi 'sent'. writeToExcel hanya true kalau tanggal yang diedit = hari ini (Excel cuma
//   snapshot live, bukan buku besar per-tanggal, jadi edit tanggal lampau tidak boleh menimpa laporan
//   hari ini yang sedang live).
export async function executeShiftEdit({ id, target, waktu, mergedPayload, actorSession, writeToExcel, send, sendCount }) {
  if (!send) {
    await db.from('submissions').update({
      payload: mergedPayload,
      edited_at: new Date().toISOString(),
      edited_by_id: actorSession.id,
      edited_by_username: actorSession.username
    }).eq('id', id);
    await logAudit(actorSession, 'SIMPAN_' + target.toUpperCase(), { tanggal: mergedPayload.tanggal, waktu, draft: true });
    return { cellsWritten: 0, waSent: false, warn: null, wroteToExcel: false, isDraft: true };
  }

  let written = [];
  if (writeToExcel) {
    const cellMap = buildShiftCellMap(target, mergedPayload, waktu);
    written = await writeCells(cellMap);
  }

  await db.from('submissions').update({
    payload: mergedPayload,
    status: 'sent',
    send_count: sendCount,
    edited_at: new Date().toISOString(),
    edited_by_id: actorSession.id,
    edited_by_username: actorSession.username
  }).eq('id', id);

  await logAudit(actorSession, 'EDIT_' + target.toUpperCase(), { tanggal: mergedPayload.tanggal, waktu, cellsWritten: written.length, wroteToExcel: writeToExcel, sendCount });

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_SHIFT, { target, waktu, tanggal: mergedPayload.tanggal });
  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null, wroteToExcel: writeToExcel };
}

// Edit data REKAP lama lewat menu Monitoring — sama seperti executeShiftEdit di atas.
export async function executeRekapEdit({ id, mergedPayload, actorSession, writeToExcel, send, sendCount }) {
  if (!send) {
    await db.from('submissions').update({
      payload: mergedPayload,
      edited_at: new Date().toISOString(),
      edited_by_id: actorSession.id,
      edited_by_username: actorSession.username
    }).eq('id', id);
    await logAudit(actorSession, 'SIMPAN_REKAP', { tanggal: mergedPayload.tanggal, draft: true });
    return { cellsWritten: 0, waSent: false, warn: null, wroteToExcel: false, isDraft: true };
  }

  let written = [];
  if (writeToExcel) {
    const cellMap = buildRekapCellMap(mergedPayload);
    written = await writeCells(cellMap);
  }

  await db.from('submissions').update({
    payload: mergedPayload,
    status: 'sent',
    send_count: sendCount,
    edited_at: new Date().toISOString(),
    edited_by_id: actorSession.id,
    edited_by_username: actorSession.username
  }).eq('id', id);

  await logAudit(actorSession, 'EDIT_REKAP', { tanggal: mergedPayload.tanggal, cellsWritten: written.length, wroteToExcel: writeToExcel, sendCount });

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_REKAP, { tanggal: mergedPayload.tanggal });
  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null, wroteToExcel: writeToExcel };
}

// Tombol LIBUR PRODUKSI (per shift saja — Rekap TIDAK ikut, sesuai keputusan: cukup shift dulu).
// Mengosongkan semua cell data + PH Santan shift terkait di Excel (writeCellsForce, bukan writeCells,
// karena string kosong di sini harus benar-benar ditulis), tapi kolom Tanggal tetap diupdate ke
// tanggal hari ini supaya nanti API dashboard mengeluarkan JSON "tidak ada data" utk tanggal itu.
// Header baris 4 SENGAJA tidak disentuh (tetap label shift/waktu terakhir yang pernah disubmit).
export async function executeShiftLibur({ target, waktu, tanggalDisplay, actorSession }) {
  const tanggalExcel = toExcelYearShort(tanggalDisplay);
  const cellMap = buildShiftLiburCellMap(target, tanggalExcel);
  const written = await writeCellsForce(cellMap);

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_LIBUR, { target, waktu, tanggal: tanggalDisplay });
  await logAudit(actorSession, 'KIRIM_LIBUR', { target, waktu, tanggal: tanggalDisplay, cellsWritten: written.length, clearedExcel: true });

  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null };
}
