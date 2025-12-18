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

    // 2. Get search parameters
    const body = await request.json();
    const { query, category, limit = 5 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // 3. Forward to FastAPI backend
    const ragResponse = await fetch(`${RAG_API_URL}/documents/search/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, category, limit }),
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error('[DOCUMENT_SEARCH] RAG API error:', errorText);
      return NextResponse.json(
        { error: `Search failed: ${errorText}` },
        { status: ragResponse.status }
      );
    }

    const result = await ragResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[DOCUMENT_SEARCH_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
