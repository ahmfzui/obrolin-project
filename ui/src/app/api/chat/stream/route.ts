import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextRequest } from 'next/server';
import { db } from '../../../../lib/db';

const RAG_API_URL = process.env.RAG_API_URL || 'http://127.0.0.1:5000';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { question, category, conversation_id } = body;

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!category) {
      return new Response(
        JSON.stringify({ error: 'Category is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If conversation_id is missing, create one on the FastAPI side
    let convId = conversation_id;
    if (!convId) {
      const createResp = await fetch(`${RAG_API_URL}/conversations/create/`, { method: 'POST' });
      if (!createResp.ok) {
        const err = await createResp.text();
        console.error('Failed to create conversation on RAG:', err);
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
      const createData = await createResp.json();
      convId = createData.conversation_id;
    }

    // Forward to FastAPI chat endpoint (streaming)
    const response = await fetch(`${RAG_API_URL}/conversations/chat-stream/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: convId,
        content: question,
        category,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI chat error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to call backend chat' }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    // Prepare for DB update
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    const decoder = new TextDecoder();
    let accumulatedAnswer = '';

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        controller.enqueue(chunk);
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);
              if (data.stage === 'complete' && data.full_content) {
                accumulatedAnswer = data.full_content;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      },
      async flush(controller) {
        if (userId && accumulatedAnswer) {
          try {
            const existing = await db.chat.findFirst({ where: { conversation_id: convId, userId } } as any);
            if (existing) {
              await db.chat.update({ 
                where: { Chat_id: existing.Chat_id }, 
                data: { 
                  Category: category, 
                  Question: question, 
                  Answer: accumulatedAnswer,
                  message_count: { increment: 1 }
                } as any
              });
            } else {
              await db.chat.create({ 
                data: { 
                  userId, 
                  Category: category, 
                  Question: question, 
                  Answer: accumulatedAnswer, 
                  conversation_id: convId,
                  message_count: 1
                } as any
              });
            }
          } catch (err) {
            console.error('Failed to save chat history:', err);
          }
        }
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });


  } catch (error: any) {
    console.error('Stream proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
