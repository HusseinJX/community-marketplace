import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getMember } from '@/lib/api'
import { promoteOccasionToGroup } from '@/lib/collab-network'

// POST — turn an "outing" (individual invites sharing occasion_id) into one
// group room, pulling in everyone who accepted. Body: { occasionId, title, memberId? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const occasionId = String(body.occasionId ?? '').trim()
  if (!occasionId) return NextResponse.json({ error: 'Missing occasion' }, { status: 400 })
  const title = String(body.title ?? '').trim() || 'Group outing'

  // Demo: don't write; report a plausible room id for the success toast.
  if (actor.isDemo) return NextResponse.json({ roomId: 'demo-room-new', added: 0, demo: true })

  let ownerName: string | null = null
  try {
    const v = await getMember(actor.memberId)
    ownerName = (v.member.profile?.businessName as string) || (v.member.profile?.name as string) || null
  } catch {
    /* non-fatal */
  }

  const { room, added } = await promoteOccasionToGroup({
    owner_id: actor.memberId,
    owner_name: ownerName,
    occasion_id: occasionId,
    title,
  })
  return NextResponse.json({ roomId: room.id, added })
}
