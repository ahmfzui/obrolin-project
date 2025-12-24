import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5000';

export async function POST(request: Request) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get form data from request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string || 'General';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 3. Forward to FastAPI backend
    const ragFormData = new FormData();
    ragFormData.append('file', file);
    ragFormData.append('category', category);

    const ragResponse = await fetch(`${RAG_API_URL}/documents/upload-stream`, {
      method: 'POST',
      body: ragFormData,
      // Important: do not set Content-Type header for FormData, fetch does it automatically with boundary
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error('[DOCUMENT_UPLOAD_STREAM] RAG API error:', errorText);
      return NextResponse.json(
        { error: `Upload failed: ${errorText}` },
        { status: ragResponse.status }
      );
    }

    // 4. Stream the response back to the client
    // We need to create a new ReadableStream that pipes the response from the backend
    const stream = ragResponse.body;

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[DOCUMENT_UPLOAD_STREAM_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
