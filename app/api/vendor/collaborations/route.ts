import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getCollaborationsFor } from '@/lib/collab-network'
import { demoCollaborations } from '@/lib/demo-collab'

// GET — the actor's collaborations (occasions): group room + member count +
// active event + individual chats. Powers the network "Collaborations" tab.
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ collaborations: demoCollaborations(actor.memberId) })
  return NextResponse.json({ collaborations: await getCollaborationsFor(actor.memberId) })
}
