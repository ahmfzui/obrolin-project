import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

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

        const user = await db.user.findUnique({
          where: {
            Email: credentials.email,
          },
        });

        if (!user || !user.Password) {
          throw new Error('User tidak ditemukan');
        }

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.Password
        );

        if (!isPasswordCorrect) {
          throw new Error('Password salah');
        }

        // Sesuai skema baru Anda: 'id' (huruf i kecil)
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