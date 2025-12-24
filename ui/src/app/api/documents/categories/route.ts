import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

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

    // 2. Forward to FastAPI backend for canonical categories
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

    // 3. Read local categories and merge (local ones take precedence/append)
    const local = await readLocalCategories();
    const merged = [...ragCats];
    for (const l of local) if (!merged.includes(l)) merged.push(l);

    return NextResponse.json({ categories: merged });

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
