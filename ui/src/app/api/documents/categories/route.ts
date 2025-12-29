export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db as prisma } from '@/lib/db';

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5000';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'ui', 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

async function readLocalCategories(): Promise<string[]> {
  try {
    const raw = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((p) => (typeof p === 'string' ? p : p?.name || String(p)));
    return [];
  } catch (e) {
    return [];
  }
}

async function writeLocalCategory(name: string) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const current = await readLocalCategories();
    if (current.includes(name)) return;
    const updated = [...current, name];
    await fs.writeFile(CATEGORIES_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (e) {
    console.error('[CATEGORIES_WRITE_ERROR]', e);
  }
}

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

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    // Source: DB (for Admin Upload)
    if (source === 'db') {
      try {
        const categories = await prisma.category.findMany({
          select: { name: true, value: true },
          orderBy: { name: 'asc' }
        });
        // Return objects with id (value) and name
        return NextResponse.json({ 
          categories: categories.map(c => ({ id: c.value, name: c.name })) 
        });
      } catch (e) {
        console.error('Failed to fetch categories from DB', e);
        return NextResponse.json({ categories: [] });
      }
    }

    // Source: RAG/Qdrant (for Chat Window & Sidebar)
    // Default behavior if no source specified, or source=rag
    
    // Forward to FastAPI backend for canonical categories from Qdrant
    const ragResponse = await fetch(`${RAG_API_URL}/documents/categories/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    let ragCats: string[] = [];
    if (ragResponse.ok) {
      try {
        const result = await ragResponse.json();
        if (result?.categories && Array.isArray(result.categories)) {
          ragCats = result.categories.map((c: any) => (typeof c === 'string' ? c : c?.name || String(c)));
        }
      } catch (e) {
        // ignore parse
      }
    }

    // Enrich with DB names
    let enrichedCategories: { id: string; name: string }[] = [];
    try {
      const dbCategories = await prisma.category.findMany({
        select: { name: true, value: true }
      });
      
      enrichedCategories = ragCats.map(ragVal => {
        const match = dbCategories.find(d => d.value === ragVal);
        return {
          id: ragVal,
          name: match ? match.name : ragVal
        };
      });
    } catch (e) {
      console.error('Failed to enrich categories from DB', e);
      // Fallback to raw values
      enrichedCategories = ragCats.map(c => ({ id: c, name: c }));
    }
    
    return NextResponse.json({ categories: enrichedCategories });

  } catch (error) {
    console.error('[CATEGORIES_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: only allow admins to add categories
    const isAdmin = (session as any)?.user?.role === 'admin' || (session as any)?.user?.isAdmin;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name = (body?.name || body?.category || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Category name required' }, { status: 400 });
    }

    // Persist locally
    await writeLocalCategory(name);

    // Return merged categories after write
    const local = await readLocalCategories();

    // Also fetch RAG categories (best-effort)
    let ragCats: string[] = [];
    try {
      const ragResponse = await fetch(`${RAG_API_URL}/documents/categories/`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (ragResponse.ok) {
        const result = await ragResponse.json();
        if (result?.categories && Array.isArray(result.categories)) ragCats = result.categories.map((c: any) => typeof c === 'string' ? c : c?.name || String(c));
      }
    } catch (e) {
      // ignore
    }

    const merged = [...ragCats];
    for (const l of local) if (!merged.includes(l)) merged.push(l);

    return NextResponse.json({ success: true, categories: merged });

  } catch (error) {
    console.error('[CATEGORIES_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
