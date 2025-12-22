'use client';

// File ini tugasnya hanya untuk menyediakan 'SessionProvider'
// ke seluruh aplikasi Anda

import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Set global session refetch config here so all useSession() calls benefit
  // without needing per-hook options. This will refetch session every 10 minutes
  // while online which allows NextAuth to rotate the JWT (updateAge on server)
  return (
    <SessionProvider refetchInterval={60 * 10}>
      {children}
    </SessionProvider>
  );
}