import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getConversationHistory } from '../../../../lib/ragClient';
import { db } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    // ensure session
    const session = (await getServerSession(authOptions)) as any;
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { conversation_id } = body;
    if (!conversation_id) {
      return new NextResponse('conversation_id required', { status: 400 });
    }

    const userId = parseInt(session.user.id);

    // Verify that this conversation_id belongs to the logged-in user in our DB
  // Cast to `any` here to avoid TypeScript mismatch with generated Prisma types
  // (field naming / generated types can differ depending on Prisma client state).
  const linked = await db.chat.findFirst({ where: { conversation_id: conversation_id, userId } } as any);
    if (!linked) {
      // Do not expose history for conversation_ids the user does not own
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Proxy to RAG FastAPI to fetch history
    const history = await getConversationHistory(conversation_id);
    return NextResponse.json(history);
  } catch (err: any) {
    console.error('[CHAT_HISTORY_PROXY_ERROR]', err);
    return new NextResponse('Failed to fetch conversation history', { status: 502 });
  }
}
