'use client';
import { usePathname } from 'next/navigation';

// Lapisan background gambar full-layar, fixed di belakang semua konten (z-index -1).
// '/' (halaman login) pakai LOGIN.png, semua halaman lain (setelah login) pakai BG.png.
// Diberi tint warna tema (var(--overlay-tint)) + blur supaya efeknya "blurry glass" —
// gambar tetap terlihat tapi tidak menonjol/mengganggu, sesuai style kaca yang dipakai
// di card/sidebar (lihat globals.css).
export default function BackgroundLayer() {
  const pathname = usePathname();
  const isLogin = pathname === '/';
  const image = isLogin ? '/LOGIN.png' : '/BG.png';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        backgroundImage: `linear-gradient(var(--overlay-tint), var(--overlay-tint)), url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'blur(10px)',
        transform: 'scale(1.08)' // hindari pinggiran putih/transparan akibat blur
      }}
    />
  );
}
