import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { onboardFromMessages, patchMember } from '@/lib/api'
import { resolveActor } from '@/lib/admin'
import { getVendorEventById } from '@/lib/vendor-connect'
import { createInvite, setEventInviteStatus } from '@/lib/collab-network'
import { getOpenAI, CHAT_MODEL } from '@/lib/openai'
import { BUSINESS_SIZES, OWNERSHIP_TAGS } from '@/lib/business-facets'
import { isDemoMode } from '@/lib/demo-admin'

const SIZE_KEYS = BUSINESS_SIZES.map((s) => s.key)
const OWN_KEYS = OWNERSHIP_TAGS.map((o) => o.key)
const FACETS_SCHEMA = {
  type: 'object',
  properties: {
    businessSize: { type: ['string', 'null'], enum: [...SIZE_KEYS, null] },
    ownershipTags: { type: 'array', items: { type: 'string', enum: [...OWN_KEYS] } },
  },
  required: ['businessSize', 'ownershipTags'],
  additionalProperties: false,
} as const

// Best-effort: infer business size + ownership/type facets from the conversation
// and write them onto the new member. Never blocks onboarding.
async function applyFacets(memberId: string, transcript: string) {
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'From this onboarding conversation, infer the business facets. ' +
            'businessSize: solo (1 person), small (2–10), medium (11–50), large (50+) — null if unclear. ' +
            'ownershipTags: any that clearly apply — local-owner, independent, just-started, long-time, ' +
            'multiple-locations, multiple-businesses, family-owned, franchise, corporate. Do not guess; only include what is stated or strongly implied.',
        },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'facets', schema: FACETS_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}')
    const businessSize = SIZE_KEYS.includes(parsed.businessSize) ? parsed.businessSize : undefined
    const ownershipTags = Array.isArray(parsed.ownershipTags)
      ? parsed.ownershipTags.filter((t: unknown): t is string => typeof t === 'string' && OWN_KEYS.includes(t as never))
      : []
    if (businessSize || ownershipTags.length) {
      await patchMember(memberId, { ...(businessSize ? { businessSize } : {}), ownershipTags })
    }
  } catch {
    // Non-fatal — facets can be set later on the profile.
  }
}

export const runtime = 'nodejs'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

// POST { messages, eventId?, mode } — finish a QR/booth onboarding conversation:
// the connector profiles the whole transcript (same brain as SMS/web), creates
// the member + vectors, then we tag it onto the event lineup.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in to finish' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) return NextResponse.json({ error: 'No conversation yet' }, { status: 400 })

  const eventId = body.eventId ? String(body.eventId) : null
  const mode = body.mode === 'organizer' ? 'organizer' : 'self'

  let event = null
  if (eventId) {
    event = await getVendorEventById(eventId)
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (mode === 'organizer') {
      const actor = await resolveActor(event.member_id)
      if (!actor || actor.memberId !== event.member_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }
  }

  let member
  try {
    member = await onboardFromMessages(messages, { source: mode === 'self' ? 'qr_onboard' : 'interview' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create your profile'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const name = (member.profile?.name as string) || 'Your business'

  // Infer + store size/ownership facets from the chat.
  await applyFacets(member.id, messages.map((m) => `${m.role === 'user' ? 'Them' : 'Host'}: ${m.content}`).join('\n'))

  if (event) {
    try {
      if (mode === 'organizer') {
        const inv = await createInvite({
          from_id: event.member_id, from_name: event.member_name,
          to_id: member.id, to_name: name, message: `Onboarded to ${event.title}`,
          scope_type: 'event', scope_id: event.id, role: 'vendor',
        })
        await setEventInviteStatus(inv.id, event.id, 'accepted')
      } else {
        await createInvite({
          from_id: member.id, from_name: name, to_id: member.id, to_name: name,
          message: 'Onboarded via the event link',
          scope_type: 'event', scope_id: event.id, role: 'vendor',
        })
      }
    } catch {
      // Best-effort lineup tag; the member exists regardless.
    }
  }

  return NextResponse.json({ memberId: member.id, name, claimUrl: `/claim/${member.id}` })
}
