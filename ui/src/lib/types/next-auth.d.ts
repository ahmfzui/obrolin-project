// Ini adalah file "Module Augmentation"
// Ini memberitahu TypeScript untuk 'menimpa' tipe default dari next-auth

import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

// 1. Perluas tipe 'JWT'
declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    // Tambahkan properti 'id' dan 'role' ke token
    id: string;
    role: string;
  }
}

// 2. Perluas tipe 'Session'
declare module 'next-auth' {
  interface Session {
    user: {
      // Tambahkan 'id' dan 'role' ke 'session.user'
      id: string;
      role: string;
    } & DefaultSession['user']; // <-- Jaga agar properti default (name, email, image) tetap ada
  }

  // 3. (Opsional) Perluas tipe 'User'
  interface User extends DefaultUser {
    role: string;
  }
}