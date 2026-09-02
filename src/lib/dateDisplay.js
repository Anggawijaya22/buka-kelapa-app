// Format ISO "YYYY-MM-DD" (nilai asli <input type="date">) jadi teks "DD/MM/YYYY" utk ditampilkan.
// Dipakai sebagai penegas visual di SAMPING widget kalender native <input type="date"> — soalnya
// tampilan kalender bawaan browser (urutan bulan/hari) ikut locale device/OS user, BUKAN dikontrol
// dari kode aplikasi (atribut lang="id" di <html> tidak selalu dihormati, terutama di Chrome), jadi
// admin yang device-nya ber-locale Inggris bisa melihat widget kalendernya sebagai mm/dd/yyyy walau
// nilai yang tersimpan & dikirim ke server tetap benar. Label ini memastikan admin selalu punya
// konfirmasi format Indonesia (dd/mm/yyyy) yang jelas, apa pun locale device-nya.
export function formatIsoDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
