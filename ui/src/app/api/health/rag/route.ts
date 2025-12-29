export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const ragApiUrl = process.env.RAG_API_URL;

  if (!ragApiUrl) {
    return NextResponse.json(
      { ok: false, error: 'RAG_API_URL is not set' },
      { status: 500 }
    );
  }

  const controller = new AbortController();
  const timeoutMs = 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  console.log('Pinging RAG API health endpoint at', ragApiUrl);
  try {
    const res = await fetch(`${ragApiUrl.replace(/\/$/, '')}/health/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text().catch(() => '');
    return NextResponse.json(
      {
        ok: res.ok,
        ragApiUrl,
        status: res.status,
        body: text ? text.slice(0, 500) : null,
      },
      { status: res.ok ? 200 : 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        ragApiUrl,
        error: err?.name === 'AbortError' ? `Timeout after ${timeoutMs}ms` : (err?.message ?? 'Fetch failed'),
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}