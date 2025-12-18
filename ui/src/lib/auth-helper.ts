import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getAuthSession() {
  const session = await getServerSession(authOptions);
  
  console.log('[Auth Helper] Session check:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    timestamp: new Date().toISOString(),
  });

  return session;
}