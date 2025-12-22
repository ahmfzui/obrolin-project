export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { chat_id, conversation_id } = body;

    if (!chat_id && !conversation_id) {
      return new NextResponse('Chat ID or Conversation ID required', { status: 400 });
    }

    const userId = parseInt(session.user.id as string);

    // Delete from local DB
    if (chat_id) {
      await db.chat.deleteMany({
        where: {
          Chat_id: chat_id,
          userId: userId,
        },
      });
    } else if (conversation_id) {
      await db.chat.deleteMany({
        where: {
          conversation_id: conversation_id,
          userId: userId,
        },
      });
    }

    // Note: We might also want to delete from RAG API if needed, 
    // but for now we just hide it from the user's view by deleting the local reference.
    // If strict cleanup is needed, we would call the RAG delete endpoint here.

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE_CHAT_ERROR]', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
