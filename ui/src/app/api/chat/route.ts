import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
// Pastikan path ini benar: dari /api/chat/ naik 1 level ke /api/
import { authOptions } from '../auth/[...nextauth]/route';
// Use relative imports here so tsc resolves them when running diagnostics
import { db } from '../../../lib/db';
import { createConversation, chatWithRag } from '../../../lib/ragClient';

const DAILY_LIMIT = 50; // Sesuai FR-10 (Batas Pertanyaan Harian)

// Ini adalah fungsi GET untuk mengambil riwayat (sudah kita buat sebelumnya)
export async function GET(request: Request) {
  try {
  // session typing augmentation sometimes isn't picked up by tsc in this environment;
  // cast to any to avoid type errors while still performing runtime checks.
  const session = (await getServerSession(authOptions)) as any;
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const userId = parseInt(session.user.id);

    const history = await db.chat.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        created_at: 'desc', // Ambil yang terbaru dulu
      },
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error('[CHAT_HISTORY_GET_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Ini adalah fungsi POST untuk mengirim pesan (YANG KITA MODIFIKASI)
export async function POST(request: Request) {
  try {
  // 1. Cek Autentikasi (Siapa yang bertanya?)
  // Cast to any as type augmentation may not be recognized by the TS process running here
  const session = (await getServerSession(authOptions)) as any;
    
    // DEBUG LOG (opsional)
    console.log('[CHAT_POST] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasUserId: !!session?.user?.id,
    });

    if (!session || !session.user || !session.user.id) {
      console.error('[CHAT_POST] Unauthorized access attempt');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const userId = parseInt(session.user.id);

    // 2. Ambil data dari Frontend (conversation_id sekarang optional)
    const body = await request.json();
    const { question, category, conversation_id } = body;

    console.log('[CHAT_POST] Request data:', { question, category, conversation_id });

    if (!question || !category) {
      return new NextResponse(
        'Data tidak lengkap (question & category wajib)',
        {
          status: 400,
        }
      );
    }

    // 3. Implementasi Use Case: Memeriksa Limit Pertanyaan (FR-10)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set ke awal hari

    const dailyCount = await db.chat.count({
      where: {
        userId: userId,
        created_at: {
          gte: today,
        },
      },
    });

    console.log('[CHAT_POST] Daily count:', dailyCount, '/', DAILY_LIMIT);

    if (dailyCount >= DAILY_LIMIT) {
      return new NextResponse(
        JSON.stringify({
          answer: 'Anda telah mencapai batas pertanyaan harian.',
        }),
        { status: 429 }
      );
    }

    // 4. Panggil API RAG Eksternal (jika conversation_id tidak diberikan, buat dulu)
    let conversationId = conversation_id;
    try {
      if (!conversationId) {
        console.log('[CHAT_POST] conversation_id missing - creating new conversation via RAG');
        const created = await createConversation();
        conversationId = created.conversation_id;
        console.log('[CHAT_POST] Created conversation on RAG:', conversationId);
      }

      console.log('[CHAT_POST] Calling RAG API (chat) with conversation:', conversationId);
      const ragData = await chatWithRag(conversationId, question, category);
      const ragAnswer = ragData.response; // jawaban AI
      console.log('[CHAT_POST] RAG response received, length:', ragAnswer?.length);

      // 5. Simpan ke Database Riwayat (Sesuai ERD)
      // If we created a lightweight row at conversation start, update it instead of creating a duplicate.
      try {
        const existing = await db.chat.findFirst({ where: { conversation_id: conversationId, userId } } as any);
        if (existing) {
          await db.chat.update({
            where: { Chat_id: existing.Chat_id },
            data: {
              Category: category,
              Question: question,
              Answer: ragAnswer,
            } as any,
          });
        } else {
          await db.chat.create({
            data: {
              userId: userId,
              Category: category,
              Question: question,
              Answer: ragAnswer, // menyimpan jawaban AI asli
              conversation_id: conversationId,
            } as any,
          });
        }
      } catch (dbErr: any) {
        console.warn('[CHAT_POST] DB save failed (non-fatal):', dbErr?.message || dbErr);
      }

      console.log('[CHAT_POST] Saved to database successfully');

      // 6. Kirim jawaban kembali ke Frontend (sertakan conversation_id agar klien bisa menyimpan)
      return NextResponse.json({ answer: ragAnswer, conversation_id: conversationId });
    } catch (err: any) {
      console.error('[CHAT_POST] API RAG gagal atau error lain:', err);
      return new NextResponse('Server RAG sedang bermasalah.', {
        status: 502,
      });
    }
  } catch (error) {
    console.error('[CHAT_API_POST_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}