import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const body = await request.json()
  const { rating, chatId, comment, conversation_id } = body
    const parsedRating = Number(rating)
    if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer 1-5' }, { status: 400 })
    }

  // Store numeric rating (1-5) in the Chat.Feedback column.
  const userIdNum = Number((session.user as any).id)
  const dbAny = db as any

  // NOTE: We allow users to submit feedback for multiple chats, but only once per chat.

  // Determine the target chat: either the provided chatId, or the user's latest chat.
  let targetChat: any = null
  if (chatId) {
    const chatIdNum = Number(chatId)
    targetChat = await dbAny.chat.findUnique({ where: { Chat_id: chatIdNum } })
    if (!targetChat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
  } else if (conversation_id) {
    // If a conversation_id is provided, find the chat row linked to this conversation for this user.
    targetChat = await dbAny.chat.findFirst({ where: { conversation_id: conversation_id, userId: userIdNum } })
    if (!targetChat) {
      return NextResponse.json({ error: 'Chat for conversation_id not found' }, { status: 404 })
    }
  } else {
    if (!userIdNum) {
      return NextResponse.json({ error: 'No chatId provided and session user id unavailable' }, { status: 400 })
    }
    targetChat = await dbAny.chat.findFirst({
      where: { userId: userIdNum },
      orderBy: { created_at: 'desc' },
    })
    if (!targetChat) {
      return NextResponse.json({ error: 'No existing chat found for this user to attach feedback to' }, { status: 400 })
    }
  }

  // Only the owner of the chat may rate it
  if (targetChat.userId && userIdNum && Number(targetChat.userId) !== userIdNum) {
    return NextResponse.json({ error: 'Forbidden: cannot rate chat belonging to another user' }, { status: 403 })
  }

  // Enforce one feedback per chat as well
  if (targetChat.Feedback !== null && targetChat.Feedback !== undefined) {
    return NextResponse.json({ error: 'Feedback already submitted for this chat' }, { status: 400 })
  }

  const updatedChat = await dbAny.chat.update({
    where: { Chat_id: targetChat.Chat_id },
    data: { Feedback: parsedRating },
  })

  return NextResponse.json({ success: true, chat: updatedChat })
  } catch (err) {
    console.error('[FEEDBACK_POST_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
