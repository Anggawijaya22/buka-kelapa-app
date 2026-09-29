// Batas jumlah "Kirim Data" beneran (bukan cuma Simpan) sebelum sebuah record submissions
// terkunci untuk Admin Shift/Admin Atas. Developer selalu bebas dari batas ini.
export const MAX_SEND_COUNT = 3;

// Batas percobaan login salah berturut-turut sebelum akun terkunci (harus direset admin).
// Lihat src/app/api/auth/login/route.js.
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
