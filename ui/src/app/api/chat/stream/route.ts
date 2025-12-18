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

    // Forward to FastAPI chat endpoint (non-streaming)
    const response = await fetch(`${RAG_API_URL}/conversations/chat/`, {
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

    const data = await response.json();
    const fullText = data.response ?? '';

    // Persist the QA into our DB so the sidebar/history shows the content.
    try {
      const session = await getServerSession(authOptions) as any;
      const userId = session?.user?.id ? parseInt(session.user.id) : null;
      if (userId) {
        // attempt to find existing lightweight row created at start
        const existing = await db.chat.findFirst({ where: { conversation_id: convId, userId } } as any);
        if (existing) {
          await db.chat.update({ where: { Chat_id: existing.Chat_id }, data: { Category: category, Question: question, Answer: fullText } as any });
        } else {
          await db.chat.create({ data: { userId, Category: category, Question: question, Answer: fullText, conversation_id: convId } as any });
        }
      }
    } catch (dbErr: any) {
      console.warn('[STREAM_ROUTE] Failed to persist chat to DB (non-fatal):', dbErr?.message || dbErr);
    }

    // Convert non-streaming response into SSE stream expected by client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // send initial thinking stage
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'thinking', message: 'Processing...' })}\n\n`));

        // small pause before streaming content
        // then stream in chunks
        const chunkSize = 64; // characters per chunk
        let sent = 0;

        function sendNextChunk() {
          if (sent >= fullText.length) {
            // complete
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'complete', full_content: fullText })}\n\n`));
            controller.close();
            return;
          }

          const chunk = fullText.slice(sent, sent + chunkSize);
          sent += chunk.length;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'streaming', content: chunk })}\n\n`));

          // schedule next chunk
          setTimeout(sendNextChunk, 30);
        }

        // small delay then start streaming
        setTimeout(sendNextChunk, 50);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
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
