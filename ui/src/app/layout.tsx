import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers'; // <-- 1. Impor provider kita

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Obrol.in Chat Bot',
  description: 'Layanan Informasi Akademik',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 2. Bungkus 'children' dengan <Providers> */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}