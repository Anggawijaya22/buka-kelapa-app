import { buildShiftCellMap, buildRekapCellMap } from './excel-map';
import { writeCells } from './graph';
import { triggerN8n } from './n8n';
import { db, logAudit } from './db';

// Eksekusi tulis Excel + trigger n8n untuk SHIFT.
// actorSession = pemilik data (admin yang submit awal) — dipakai untuk submissions & audit log,
// supaya riwayat tetap tercatat atas nama admin walau eksekusinya dipicu oleh ACC viewer.
export async function executeShiftSubmit({ target, waktu, form, actorSession, actionLabel }) {
  const cellMap = buildShiftCellMap(target, form);
  const written = await writeCells(cellMap);

  await db.from('submissions').insert({
    user_id: actorSession.id,
    username: actorSession.username,
    target,
    tanggal: form.tanggalIso || null,
    payload: { ...form, waktu }
  });
  await logAudit(actorSession, actionLabel || ('SUBMIT_' + target.toUpperCase()), { tanggal: form.tanggal, waktu, cells: written.length });

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_SHIFT, { target, waktu, tanggal: form.tanggal });
  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null };
}

// Eksekusi tulis Excel + trigger n8n untuk REKAP.
export async function executeRekapSubmit({ form, actorSession, actionLabel }) {
  const cellMap = buildRekapCellMap(form);
  const written = await writeCells(cellMap);

  await db.from('submissions').insert({
    user_id: actorSession.id,
    username: actorSession.username,
    target: 'rekap',
    tanggal: form.tanggalIso || null,
    payload: form
  });
  await logAudit(actorSession, actionLabel || 'SUBMIT_REKAP', { tanggal: form.tanggal, cells: written.length });

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_REKAP, { tanggal: form.tanggal });
  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null };
}

// Edit data SHIFT lama lewat menu History — menimpa payload submission yang sama (bukan insert baru).
// writeToExcel hanya true kalau tanggal yang diedit = hari ini (Excel cuma snapshot live, bukan
// buku besar per-tanggal, jadi edit tanggal lama tidak boleh menimpa laporan hari ini yang sedang live).
export async function executeShiftEdit({ id, target, waktu, mergedPayload, actorSession, writeToExcel }) {
  let written = [];
  if (writeToExcel) {
    const cellMap = buildShiftCellMap(target, mergedPayload);
    written = await writeCells(cellMap);
  }

  await db.from('submissions').update({
    payload: mergedPayload,
    edited_at: new Date().toISOString(),
    edited_by_id: actorSession.id,
    edited_by_username: actorSession.username
  }).eq('id', id);

  await logAudit(actorSession, 'EDIT_' + target.toUpperCase(), { tanggal: mergedPayload.tanggal, waktu, cellsWritten: written.length, wroteToExcel: writeToExcel });

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_SHIFT, { target, waktu, tanggal: mergedPayload.tanggal });
  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null, wroteToExcel: writeToExcel };
}

// Edit data REKAP lama lewat menu History — sama seperti executeShiftEdit di atas.
export async function executeRekapEdit({ id, mergedPayload, actorSession, writeToExcel }) {
  let written = [];
  if (writeToExcel) {
    const cellMap = buildRekapCellMap(mergedPayload);
    written = await writeCells(cellMap);
  }

  await db.from('submissions').update({
    payload: mergedPayload,
    edited_at: new Date().toISOString(),
    edited_by_id: actorSession.id,
    edited_by_username: actorSession.username
  }).eq('id', id);

  await logAudit(actorSession, 'EDIT_REKAP', { tanggal: mergedPayload.tanggal, cellsWritten: written.length, wroteToExcel: writeToExcel });

  const n8n = await triggerN8n(process.env.N8N_WEBHOOK_REKAP, { tanggal: mergedPayload.tanggal });
  return { cellsWritten: written.length, waSent: n8n.ok, warn: n8n.warn || null, wroteToExcel: writeToExcel };
}
