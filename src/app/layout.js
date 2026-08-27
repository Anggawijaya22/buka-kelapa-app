import './globals.css';

export const metadata = {
  title: 'Buka Kelapa App',
  description: 'Input laporan produksi buka kelapa',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f6e56'
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BukaKelapa" />
        {/* Terapkan dark mode SEBELUM render supaya tidak kedip putih dulu (tiap user pilih sendiri, tersimpan di localStorage) */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('bk_theme') === 'dark') {
              document.documentElement.setAttribute('data-theme', 'dark');
            }
          } catch (e) {}
        `}} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
      </body>
    </html>
  );
}
