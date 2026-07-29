import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rateLimit } from '@/lib/rate-limit'
import { reportPost } from '@/lib/moderation'

// POST — flag a post as objectionable (App Store 1.2). Records the report,
// notifies the developer, and auto-removes past a threshold. Signed-in only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to report' }, { status: 401 })

  const limited = rateLimit({ req, name: 'report', id: userId, limit: 20, windowMs: 600_000 })
  if (limited) return limited

  const b = (await req.json().catch(() => ({}))) as { reason?: string; note?: string; authorId?: string }
  const reason = (b.reason ?? 'objectionable').toString().slice(0, 80)
  try {
    await reportPost({
      postId: id,
      reporterId: userId,
      authorId: b.authorId ?? null,
      reason,
      note: (b.note ?? '').toString().slice(0, 500) || null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
