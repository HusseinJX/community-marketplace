import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import {
  getConversationsByMember,
  getMessagesByConversation,
  getLeadsByMember,
} from '@/lib/vendor-connect'

// The vendor inbox: conversations customers had with this business's AI
// assistant (the "Ask {business}" / Inquire widget). Each is a DM thread the
// owner can read. Clerk-authed via resolveActor (admin can pass ?memberId=).
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [conversations, leads] = await Promise.all([
    getConversationsByMember(actor.memberId, 40),
    getLeadsByMember(actor.memberId),
  ])
  const leadByConv = new Map(leads.filter((l) => l.conversation_id).map((l) => [l.conversation_id!, l]))

  const threads = await Promise.all(
    conversations.map(async (c) => {
      const msgs = await getMessagesByConversation(c.id)
      const firstUser = msgs.find((m) => m.role === 'user')
      const last = msgs[msgs.length - 1]
      const lead = leadByConv.get(c.id)
      return {
        id: c.id,
        createdAt: c.created_at,
        lastAt: last?.created_at ?? c.created_at,
        count: msgs.length,
        preview: (firstUser?.content ?? last?.content ?? '').slice(0, 140),
        customerName: lead?.name ?? null,
        customerContact: lead?.contact ?? null,
      }
    })
  )
  // Threads with no messages yet are noise — drop them.
  threads.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
  return NextResponse.json({ threads: threads.filter((t) => t.count > 0) })
}
