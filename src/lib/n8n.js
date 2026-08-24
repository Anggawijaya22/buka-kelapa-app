// Panggil webhook n8n — tidak melempar error agar submit Excel tetap sukses
export async function triggerN8n(url, payload) {
  if (!url) return { ok: false, warn: 'Webhook URL belum diset di env' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return { ok: false, warn: `Webhook n8n gagal (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, warn: 'Webhook n8n tidak terjangkau: ' + e.message };
  }
}
