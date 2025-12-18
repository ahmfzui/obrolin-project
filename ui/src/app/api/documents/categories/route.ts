import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5000';

export async function GET(request: Request) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Forward to FastAPI backend
    const ragResponse = await fetch(`${RAG_API_URL}/documents/categories/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error('[CATEGORIES] RAG API error:', errorText);
      return NextResponse.json(
        { error: `Failed to get categories: ${errorText}` },
        { status: ragResponse.status }
      );
    }

    const result = await ragResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[CATEGORIES_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
