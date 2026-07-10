import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getConversationsByMember, getMessagesByConversation } from '@/lib/vendor-connect'

// Full transcript of one customer conversation. Guards that the conversation
// belongs to the acting member (so a vendor can't read another's inbox).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ownership check — the conversation must be one of this member's.
  const owned = await getConversationsByMember(actor.memberId, 200)
  if (!owned.some((c) => c.id === conversationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const messages = await getMessagesByConversation(conversationId)
  return NextResponse.json({ messages })
}
