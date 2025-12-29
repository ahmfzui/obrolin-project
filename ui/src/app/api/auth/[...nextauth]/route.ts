export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Simple in-memory login attempt tracker.
// Note: this is per-server-instance and will reset on restart. For
// production/distributed deployments use a shared store (Redis, DB, etc.).
const loginAttempts = new Map<
  string,
  { count: number; lockUntil?: number }
>();
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 10 * 1000; // 10 seconds

// Ini adalah konfigurasi lengkap Anda yang sudah disesuaikan
export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Data tidak lengkap');
        }
        // rate limit by email (simple). You can extend to include IP.
        const emailKey = credentials.email.toLowerCase();
        const record = loginAttempts.get(emailKey) || { count: 0 };
        if (record.lockUntil && Date.now() < record.lockUntil) {
          const secondsLeft = Math.ceil((record.lockUntil - Date.now()) / 1000);
          throw new Error(`Terlalu banyak percobaan login. Coba lagi dalam ${secondsLeft} detik.`);
        }

        const user = await db.user.findUnique({
          where: {
            Email: credentials.email,
          },
        });

        if (!user || !user.Password) {
          // count as a failed attempt as well (avoid user enumeration by timing)
          const prev = loginAttempts.get(emailKey) || { count: 0 };
          prev.count = (prev.count || 0) + 1;
          if (prev.count >= MAX_ATTEMPTS) {
            prev.lockUntil = Date.now() + COOLDOWN_MS;
            prev.count = 0; // reset after locking
          }
          loginAttempts.set(emailKey, prev);
          throw new Error('User tidak ditemukan');
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.Password
        );

        if (!isPasswordCorrect) {
          // increment failed attempts
          const prev = loginAttempts.get(emailKey) || { count: 0 };
          prev.count = (prev.count || 0) + 1;
          if (prev.count >= MAX_ATTEMPTS) {
            prev.lockUntil = Date.now() + COOLDOWN_MS;
            prev.count = 0; // reset after locking
          }
          loginAttempts.set(emailKey, prev);
          throw new Error('Password salah');
        }

        // Sesuai skema baru Anda: 'id' (huruf i kecil)
        // login success -> clear attempts
        loginAttempts.delete(emailKey);
        return {
          id: user.id.toString(), // <-- Sudah benar
          email: user.Email,
          name: user.Name,
          role: user.Role,
        };
      },
    }),
  ],

  // --- TAMBAHAN BARU (INI SOLUSINYA) ---
  callbacks: {
    // 'jwt' callback dipanggil saat JWT (token) dibuat
    jwt({ token, user }) {
      if (user) {
        // Saat login, 'user' object (dari 'authorize') tersedia.
        // Tambahkan 'id' dan 'role' ke dalam 'token'.
        token.id = user.id;
        token.role = (user as any).role; // 'as any' jika tipe 'user' tidak punya 'role'
      }
      return token;
    },
    // 'session' callback dipanggil saat sesi dicek
    session({ session, token }) {
      if (session.user && token.id && token.role) {
        // Ambil 'id' dan 'role' dari 'token' (yang kita isi di 'jwt' callback)
        // dan masukkan ke object 'session.user'
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  // ------------------------------------
  session: {
    strategy: 'jwt',
    // session expires after 2 hours (in seconds)
    maxAge: 2 * 60 * 60,
    // rotate/refresh the JWT if the session is active and the token is older than updateAge
    // here we refresh at most every 30 minutes
    updateAge: 30 * 60,
  },
  // set jwt max age to 2 hours as well
  jwt: {
    maxAge: 2 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

// Ekspor handler
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };