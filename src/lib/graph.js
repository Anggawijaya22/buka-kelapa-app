import { db } from './db';

const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'offline_access Files.ReadWrite Files.ReadWrite.All';

// ---------- OAuth: tukar code jadi token (dipanggil sekali oleh owner) ----------
export async function exchangeCodeForToken(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      redirect_uri: process.env.MS_REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
      scope: SCOPES
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Token exchange failed');
  // Simpan refresh token ke database
  await db.from('ms_tokens').upsert({ id: 1, refresh_token: data.refresh_token, updated_at: new Date().toISOString() });
  return data;
}

// ---------- Ambil access token pakai refresh token tersimpan ----------
export async function getAccessToken() {
  const { data: row } = await db.from('ms_tokens').select('refresh_token').eq('id', 1).single();
  if (!row) throw new Error('Microsoft belum terhubung. Owner harus login sekali di /api/auth/ms/start');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      scope: SCOPES
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Refresh token failed');

  // Microsoft kadang kirim refresh token baru — simpan
  if (data.refresh_token) {
    await db.from('ms_tokens').upsert({ id: 1, refresh_token: data.refresh_token, updated_at: new Date().toISOString() });
  }
  return data.access_token;
}

// ---------- Tulis nilai ke 1 cell Excel ----------
export async function writeCell(accessToken, cellAddress, value) {
  const sheet = encodeURIComponent(process.env.MS_SHEET_NAME);
  const url = `${GRAPH}/me/drive/items/${process.env.MS_FILE_ID}/workbook/worksheets('${sheet}')/range(address='${cellAddress}')`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [[value]] })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gagal tulis ${cellAddress}: ${err?.error?.message || res.status}`);
  }
  return true;
}

// ---------- Tulis banyak cell sekaligus (batch per kolom) ----------
export async function writeCells(cellValueMap) {
  const token = await getAccessToken();
  const results = [];
  for (const [cell, value] of Object.entries(cellValueMap)) {
    if (value === undefined || value === null || value === '') continue;
    await writeCell(token, cell, value);
    results.push(cell);
  }
  return results;
}

// ---------- Tulis banyak cell sekaligus, TERMASUK yang nilainya sengaja dikosongkan ("") ----------
// Beda dari writeCells() di atas yang MELEWATI cell kosong (supaya submit sebagian data tidak
// menghapus isi cell lain) — writeCellsForce() dipakai khusus untuk kasus yang memang SENGAJA
// mau mengosongkan cell, misalnya tombol LIBUR PRODUKSI.
export async function writeCellsForce(cellValueMap) {
  const token = await getAccessToken();
  const results = [];
  for (const [cell, value] of Object.entries(cellValueMap)) {
    await writeCell(token, cell, value ?? '');
    results.push(cell);
  }
  return results;
}

// ---------- Download file Excel utuh (byte mentah, untuk tombol Download) ----------
export async function downloadExcelFile() {
  const token = await getAccessToken();
  const url = `${GRAPH}/me/drive/items/${process.env.MS_FILE_ID}/content`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Gagal download file Excel (${res.status})`);
  }
  return res.arrayBuffer();
}

// ---------- Baca range untuk dashboard ----------
export async function readRange(rangeAddress) {
  const token = await getAccessToken();
  const sheet = encodeURIComponent(process.env.MS_SHEET_NAME);
  const url = `${GRAPH}/me/drive/items/${process.env.MS_FILE_ID}/workbook/worksheets('${sheet}')/range(address='${rangeAddress}')`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gagal baca range: ${err?.error?.message || res.status}`);
  }
  const data = await res.json();
  return { values: data.values, text: data.text };
}
