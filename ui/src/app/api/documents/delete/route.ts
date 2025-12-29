import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5000';

export async function DELETE(request: Request) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get parameters
    const body = await request.json();
    const { filename, category } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // 3. Forward to FastAPI backend
    const ragResponse = await fetch(`${RAG_API_URL}/documents/delete/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, category }),
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error('[DOCUMENT_DELETE] RAG API error:', errorText);
      return NextResponse.json(
        { error: `Delete failed: ${errorText}` },
        { status: ragResponse.status }
      );
    }

    const result = await ragResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[DOCUMENT_DELETE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
