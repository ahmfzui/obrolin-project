'use client';

// File ini tugasnya hanya untuk menyediakan 'SessionProvider'
// ke seluruh aplikasi Anda

import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}