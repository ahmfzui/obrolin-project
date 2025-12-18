import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '../../../../lib/db';

export async function POST(request: Request) {
  console.log('\n========================================');
  console.log('[CHAT_START] NEW REQUEST');
  console.log('========================================');
  
  try {
    // Log headers
    console.log('[CHAT_START] Request headers:', {
      cookie: request.headers.get('cookie') ? 'EXISTS' : 'MISSING',
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent'),
    });

    // 1. Get session
    console.log('[CHAT_START] Getting session...');
    let session;
    try {
      session = await getServerSession(authOptions);
      console.log('[CHAT_START] Session result:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
      });
    } catch (sessionError) {
      console.error('[CHAT_START] ❌ Error getting session:', sessionError);
      throw sessionError;
    }

    if (!session || !session.user || !session.user.id) {
      console.error('[CHAT_START] ❌ Unauthorized - No valid session');
      return NextResponse.json(
        { error: 'Unauthorized - Please login again' },
        { status: 401 }
      );
    }

    console.log('[CHAT_START] ✅ Session valid for user:', session.user.id);

    // 2. Check RAG_API_URL
    const ragApiUrl = process.env.RAG_API_URL;
    console.log('[CHAT_START] RAG_API_URL:', ragApiUrl || 'NOT SET');
    
    if (!ragApiUrl) {
      console.error('[CHAT_START] ❌ RAG_API_URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error: RAG_API_URL missing' },
        { status: 500 }
      );
    }

  // 3. Call RAG API
    const ragEndpoint = `${ragApiUrl}/conversations/create/`;
    console.log('[CHAT_START] Calling RAG API:', ragEndpoint);
    
    let ragResponse;
    try {
      ragResponse = await fetch(ragEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('[CHAT_START] RAG API response status:', ragResponse.status);
    } catch (fetchError: any) {
      console.error('[CHAT_START] ❌ Error calling RAG API:', fetchError);
      
      // Detailed error message based on error type
      let errorMessage = 'FastAPI backend tidak dapat dijangkau. ';
      
      if (fetchError.code === 'ECONNREFUSED') {
        errorMessage += `
          
🔴 FASTAPI BACKEND TIDAK BERJALAN!

Solusi:
1. Buka terminal baru
2. Jalankan: python fastapi-app.py
3. Pastikan FastAPI running di http://localhost:5000
4. Refresh halaman ini

Error: Connection refused to ${ragApiUrl}
        `.trim();
      } else if (fetchError.code === 'ENOTFOUND') {
        errorMessage += 'Host tidak ditemukan. Periksa RAG_API_URL di .env';
      } else if (fetchError.code === 'ETIMEDOUT') {
        errorMessage += 'Connection timeout. Pastikan FastAPI berjalan dan tidak hang.';
      } else {
        errorMessage += fetchError.message || 'Unknown network error';
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          code: fetchError.code,
          ragApiUrl: ragApiUrl
        },
        { status: 502 }
      );
    }

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error('[CHAT_START] ❌ RAG API returned error:', {
        status: ragResponse.status,
        statusText: ragResponse.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: `RAG server error (${ragResponse.status}): ${errorText}` },
        { status: 502 }
      );
    }

    // 4. Parse response
    let ragData;
    try {
      ragData = await ragResponse.json();
      console.log('[CHAT_START] RAG API response data:', ragData);
    } catch (parseError) {
      console.error('[CHAT_START] ❌ Error parsing RAG response:', parseError);
      return NextResponse.json(
        { error: 'Invalid response from RAG server' },
        { status: 502 }
      );
    }

  const conversationId = ragData.conversation_id;
    if (!conversationId) {
      console.error('[CHAT_START] ❌ No conversation_id in response:', ragData);
      return NextResponse.json(
        { error: 'RAG server did not return conversation_id' },
        { status: 500 }
      );
    }

    // Persist a lightweight DB record so this conversation shows in the user's history list
    try {
      // read optional category from the request body (client may provide it)
      const body = await request.json().catch(() => ({} as any));
      const categoryFromRequest = (body && body.category) ? String(body.category) : 'Uncategorized';
      const userId = parseInt(session.user.id as string);
      await db.chat.create({
        data: {
          userId,
          Category: categoryFromRequest,
          Question: '',
          Answer: '',
          conversation_id: conversationId,
        } as any,
      });
      console.log('[CHAT_START] Created lightweight DB chat row for user:', userId);
    } catch (dbErr: any) {
      console.warn('[CHAT_START] Failed to create DB chat row (non-fatal):', dbErr?.message || dbErr);
    }

    console.log('[CHAT_START] ✅ SUCCESS - conversation_id:', conversationId);
    console.log('========================================\n');

    return NextResponse.json({ conversation_id: conversationId });

  } catch (error) {
    console.error('\n========================================');
    console.error('[CHAT_START] ❌❌❌ FATAL ERROR ❌❌❌');
    console.error('========================================');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    console.error('========================================\n');

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}