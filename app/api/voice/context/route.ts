import { NextResponse } from 'next/server'
import { buildBusinessContext } from '@/lib/business-context'
import { resolveBusinessForCall, normalizePhone } from '@/lib/business-phone'
import { sfToday } from '@/lib/sf-date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Telnyx "dynamic variables" webhook for the INBOUND BUSINESS PHONE AGENT.
//
// Telnyx calls this once at the start of every call, before the assistant
// speaks. We look up which business owns the number that was DIALED and hand
// back that business's knowledge — so one Telnyx assistant serves every
// business, and adding business #2 is a routing-table entry, not a new agent.
//
// The knowledge is the exact same blob the profile chat widget uses
// (buildBusinessContext), so the phone agent and the on-profile agent can never
// drift apart. Only the delivery instructions differ: this one is spoken.
//
// Auth: a shared secret in the query string (?s=) — Telnyx webhooks can't set
// request headers here. Same pattern as the connector's voice-context.

// Extract the dialed number from whatever shape Telnyx posts.
function extractDialed(body: Record<string, unknown>, url: URL): string | null {
  const b = body as any
  return normalizePhone(
    b?.data?.payload?.to ||
      b?.data?.payload?.telnyx_agent_target ||
      b?.payload?.to ||
      b?.telnyx_agent_target ||
      b?.to ||
      b?.call?.to ||
      url.searchParams.get('to')
  )
}

// The SIP Diversion header, present only when the call was FORWARDED to us.
// Telnyx surfaces it on assistant.initialization; it is not persisted anywhere
// afterwards, so this is the only chance to read it.
function extractDiversion(body: Record<string, unknown>): string | null {
  const b = body as any
  const v =
    b?.data?.payload?.telnyx_sip_header_diversion ||
    b?.payload?.telnyx_sip_header_diversion ||
    b?.telnyx_sip_header_diversion ||
    b?.data?.payload?.sip_headers?.Diversion ||
    b?.sip_headers?.Diversion
  return typeof v === 'string' && v.trim() ? v : null
}

function extractCaller(body: Record<string, unknown>): string | null {
  const b = body as any
  return normalizePhone(
    b?.data?.payload?.from ||
      b?.data?.payload?.telnyx_end_user_target ||
      b?.payload?.from ||
      b?.telnyx_end_user_target ||
      b?.from ||
      b?.call?.from
  )
}

// Never let a lookup failure drop the call — the agent still answers, it just
// can't answer questions about the business.
const FALLBACK = {
  member_id: '',
  business_name: 'this business',
  business_context: 'No business information is available right now.',
  business_tone: 'Be warm, concise, and helpful.',
  // Same "AI assistant first" shape as the real greeting, minus a name we
  // couldn't resolve — the disclosure leads even when the lookup failed.
  greeting_line:
    "This is an AI assistant. I'm having trouble pulling up our information right now — can I take your name and number so someone can call you back?",
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.VOICE_TOOL_SECRET
  if (secret && url.searchParams.get('s') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const dialed = extractDialed(body, url)
  const caller = extractCaller(body)
  const diversion = extractDiversion(body)

  // Forwarded calls route on the number the caller ORIGINALLY dialed, not on
  // the number the carrier handed the call to (which is always ours).
  const { memberId, businessNumber, viaForward } = resolveBusinessForCall({
    dialed,
    diversion,
  })

  // business_number is minted HERE and handed to the model so the capture_lead
  // tool can pass it back — a value we set is trustworthy in a way the model's
  // own recollection of a member id is not, and on a forwarded call the tool
  // cannot re-derive it from the dialed number.
  // today_date lets the agent turn "Thursday" into a calendar date when taking
  // a booking. City-local, never UTC — after 5pm Pacific a UTC date is already
  // tomorrow, which would book people a day out (the same bug that once hid
  // every evening's events from the feed).
  let vars = {
    ...FALLBACK,
    caller_phone: caller ?? '',
    business_number: businessNumber ?? '',
    today_date: sfToday(),
  }

  if (memberId) {
    try {
      const ctx = await buildBusinessContext(memberId)

      // The owner's tone, set by the "Tune your agent" panel (chat or voice),
      // lives in assistant_persona. The phone agent MUST honour it — otherwise
      // an owner who softened their agent hears the old one on the phone, and
      // the two channels quietly disagree about who the business is.
      const tone = ctx.persona?.trim() || 'Be warm, concise, and helpful.'

      // The same switch that turns the profile widget off turns the phone agent
      // down to a message-taker. An owner who disabled their assistant did not
      // agree to have it answer their phone.
      if (!ctx.assistantEnabled) {
        vars = {
          member_id: memberId,
          business_name: ctx.businessName,
          business_context:
            'The AI assistant is turned OFF for this business. Do not answer questions about it. Politely take a message and nothing else.',
          business_tone: 'Be brief and polite.',
          greeting_line: `This is an AI assistant for ${ctx.businessName}. I can take a message and have someone get back to you.`,
          caller_phone: caller ?? '',
          business_number: businessNumber ?? '',
          today_date: sfToday(),
        }
      } else {
        vars = {
          member_id: memberId,
          business_name: ctx.businessName,
          business_context: ctx.knowledgeBlob,
          business_tone: tone,
          // Disclosing "AI assistant" up front is deliberate: California is a
          // two-party-consent state and callers deserve to know. Recording is
          // off on this assistant for the same reason.
          greeting_line: `This is an AI assistant for ${ctx.businessName}. What can I help you with?`,
          caller_phone: caller ?? '',
          business_number: businessNumber ?? '',
          today_date: sfToday(),
        }
      }
    } catch (err) {
      console.error('voice/context lookup failed:', err)
    }
  } else if (viaForward) {
    // Someone forwarded a number we don't know to us. Answering as the shared
    // number's business would impersonate a business the caller never rang, so
    // we deliberately fall through to the generic message-taker.
    console.warn('voice/context: forwarded call from unmapped number', businessNumber)
  } else {
    console.warn('voice/context: no business mapped to dialed number', dialed)
  }

  // Flat AND wrapped, so it works regardless of which shape Telnyx reads.
  return NextResponse.json({ ...vars, dynamic_variables: vars })
}
