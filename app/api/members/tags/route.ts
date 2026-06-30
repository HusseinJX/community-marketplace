import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getTagGroups } from '@/lib/member-tags'

// GET — the acting organizer's tag groups (each tag + its members).
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ groups: await getTagGroups(actor.memberId) })
}
