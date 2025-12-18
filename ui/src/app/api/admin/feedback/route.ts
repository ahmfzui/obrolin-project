import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

  // compute average rating and count from Chat.Feedback (we store numeric 1-5 in Chat.Feedback)
  const agg = await db.$queryRaw`SELECT AVG("Feedback") as avg_rating, COUNT("Feedback") as count FROM "Chat" WHERE "Feedback" IS NOT NULL`
  // $queryRaw returns array
  const row: any = Array.isArray(agg) ? agg[0] : agg
  const avg = row?.avg_rating ? Number(row.avg_rating) : 0
  const count = row?.count ? Number(row.count) : 0

    return NextResponse.json({ average: avg, count })
  } catch (err) {
    console.error('[ADMIN_FEEDBACK_GET_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
