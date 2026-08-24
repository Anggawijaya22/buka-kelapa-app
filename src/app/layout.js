import './globals.css';

export const metadata = {
  title: 'Buka Kelapa App',
  description: 'Input laporan produksi buka kelapa',
  manifest: '/manifest.json'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f6e56'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
