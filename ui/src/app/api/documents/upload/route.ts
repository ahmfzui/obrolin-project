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

    const ragResponse = await fetch(`${RAG_API_URL}/documents/upload/`, {
      method: 'POST',
      body: ragFormData,
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      console.error('[DOCUMENT_UPLOAD] RAG API error:', errorText);
      return NextResponse.json(
        { error: `Upload failed: ${errorText}` },
        { status: ragResponse.status }
      );
    }

    const result = await ragResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[DOCUMENT_UPLOAD_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to list documents
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const url = category
      ? `${RAG_API_URL}/documents/list/?category=${encodeURIComponent(category)}`
      : `${RAG_API_URL}/documents/list/`;

    const ragResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      return NextResponse.json(
        { error: `Failed to list documents: ${errorText}` },
        { status: ragResponse.status }
      );
    }

    const result = await ragResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[DOCUMENT_LIST_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete document
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { filename, category } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    const ragResponse = await fetch(`${RAG_API_URL}/documents/delete/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, category }),
    });

    if (!ragResponse.ok) {
      const errorText = await ragResponse.text();
      return NextResponse.json(
        { error: `Failed to delete document: ${errorText}` },
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
