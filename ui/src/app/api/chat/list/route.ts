import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { listConversations } from '@/lib/ragClient';
import { db } from '@/lib/db';

export async function GET(request: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session || !session.user || !session.user.id) {
			return new NextResponse('Unauthorized', { status: 401 });
		}

		const userId = parseInt(session.user.id as string);

		// Get DB rows for user
		const chats = await db.chat.findMany({
			where: { userId },
			orderBy: { created_at: 'desc' },
		});

		// Get RAG conversation list
		let ragList = { conversations: [] } as any;
		try {
			ragList = await listConversations();
		} catch (e) {
			console.warn('[CHAT_LIST] Failed to fetch RAG conversations, continuing with DB only', e);
		}

		// Merge: for each rag conversation, try to find DB metadata
			const ragConvs = (ragList.conversations || [])
				.map((c: any) => {
					const match = chats.find((r: any) => r.conversation_id === c.conversation_id);
					return match
						? {
								conversation_id: c.conversation_id,
								created_at: c.created_at,
								last_activity: c.last_activity,
								title: match.Question,
								chat_id: match.Chat_id,
								category: match.Category,
							}
						: null;
				})
				.filter(Boolean);

			// Also include DB-only chats (no conversation_id)
			const dbOnly = chats
				.filter((c: any) => !c.conversation_id)
				.map((c: any) => ({
					conversation_id: null,
					created_at: c.created_at,
					last_activity: c.created_at,
					title: c.Question,
					chat_id: c.Chat_id,
					category: c.Category,
				}));

			const merged = [...ragConvs, ...dbOnly];

		return NextResponse.json({ conversations: merged });
	} catch (err) {
		console.error('[CHAT_LIST_ERROR]', err);
		return new NextResponse('Internal Server Error', { status: 500 });
	}
}

