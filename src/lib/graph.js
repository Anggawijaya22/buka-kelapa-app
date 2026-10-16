import { db } from './db';

const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'offline_access Files.ReadWrite Files.ReadWrite.All';

// ---------- Retry utk error SEMENTARA dari Microsoft (2026-10-16) ----------
// Hanya status yang memang berarti "coba lagi sebentar": 408/429 (timeout/throttle), 423 (workbook
// sedang terkunci), 5xx, plus putus jaringan. 404 SENGAJA TIDAK di-retry: itu artinya file/sheet
// benar-benar tidak ada (mis. file OneDrive terhapus) — mengulang cuma buang waktu. Aman dipakai
// utk PATCH satu cell karena idempoten (menulis nilai yang sama dua kali hasilnya sama).
// TIDAK dipakai di exchangeCodeForToken: authorization code cuma bisa dipakai sekali.
const RETRY_STATUS = new Set([408, 423, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw e;
      await sleep(500 * attempt * attempt);
      continue;
    }
    if (!RETRY_STATUS.has(res.status) || attempt >= MAX_ATTEMPTS) return res;
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 500 * attempt * attempt);
  }
}

// Pesan error Graph + petunjuk kalau file/sheet tidak ditemukan (supaya penyebabnya langsung jelas).
async function graphErrorText(res) {
  const err = await res.json().catch(() => ({}));
  const msg = err?.error?.message || res.status;
  return err?.error?.code === 'itemNotFound'
    ? `${msg} (file Excel tidak ditemukan di OneDrive — cek apakah file terhapus/dipindah atau MS_FILE_ID berubah)`
    : msg;
}

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

  const res = await fetchWithRetry(TOKEN_URL, {
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
  const res = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [[value]] })
  });
  if (!res.ok) {
    throw new Error(`Gagal tulis ${cellAddress}: ${await graphErrorText(res)}`);
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
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Gagal download file Excel: ${await graphErrorText(res)}`);
  }
  return res.arrayBuffer();
}

// ---------- Baca range untuk dashboard ----------
export async function readRange(rangeAddress) {
  const token = await getAccessToken();
  const sheet = encodeURIComponent(process.env.MS_SHEET_NAME);
  const url = `${GRAPH}/me/drive/items/${process.env.MS_FILE_ID}/workbook/worksheets('${sheet}')/range(address='${rangeAddress}')`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Gagal baca range: ${await graphErrorText(res)}`);
  }
  const data = await res.json();
  return { values: data.values, text: data.text };
}
