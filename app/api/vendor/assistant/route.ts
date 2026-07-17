import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getVendorProfile,
  getVendorSettings,
  upsertVendorSettings,
  getBusinessKnowledge,
  addBusinessKnowledge,
  deleteBusinessKnowledge,
  getLeadsByMember,
} from '@/lib/vendor-connect'
import { getMember } from '@/lib/api'
import { resolveReadActor } from '@/lib/admin'

async function requireMember() {
  const { userId } = await auth()
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const profile = await getVendorProfile(userId)
  if (!profile) return { error: NextResponse.json({ error: 'No vendor profile' }, { status: 403 }) }
  return { memberId: profile.member_id }
}

export async function GET() {
  // Read-only, so a demo visitor may resolve a representative member (writes
  // below still use the strict requireMember). This is what lets the "Test
  // agent" / "View profile" buttons appear + work in the admin demo — the demo
  // actor is seeded from a REAL member, so the chat actually answers.
  const actor = await resolveReadActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const m = { memberId: actor.memberId }
  const [settings, knowledge, leads] = await Promise.all([
    getVendorSettings(m.memberId),
    getBusinessKnowledge(m.memberId),
    getLeadsByMember(m.memberId),
  ])
  // memberId + name so the page can link to the public profile and mount the
  // owner's own agent chat ("Test agent"). Name is best-effort — the chat header
  // falls back gracefully if the connector is slow.
  let memberName = 'your business'
  try {
    const mem = await getMember(m.memberId)
    const p = (mem as { member?: { profile?: { businessName?: string; name?: string } } })?.member?.profile
    memberName = p?.businessName || p?.name || memberName
  } catch {
    /* keep fallback */
  }

  return NextResponse.json({
    memberId: m.memberId,
    memberName,
    enabled: settings?.assistant_enabled !== false,
    persona: settings?.assistant_persona ?? '',
    knowledge,
    leads,
  })
}

export async function POST(req: Request) {
  const m = await requireMember()
  if (m.error) return m.error

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  if (action === 'config') {
    await upsertVendorSettings(m.memberId, {
      assistant_enabled: Boolean(body.enabled),
      assistant_persona: typeof body.persona === 'string' ? body.persona.slice(0, 2000) : null,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_knowledge') {
    const content = String(body.content ?? '').trim()
    if (!content) return NextResponse.json({ error: 'Empty content' }, { status: 400 })
    await addBusinessKnowledge(m.memberId, content.slice(0, 4000))
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_knowledge') {
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await deleteBusinessKnowledge(id, m.memberId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
