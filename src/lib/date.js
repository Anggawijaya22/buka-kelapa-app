// Format tanggal ISO (YYYY-MM-DD) yang dipakai konsisten sebagai kolom `submissions.tanggal`
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
