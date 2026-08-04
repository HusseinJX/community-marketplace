import { NextResponse } from 'next/server'
import { buildBusinessContext } from '@/lib/business-context'
import { memberIdForNumber, normalizePhone } from '@/lib/business-phone'

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
  greeting_line:
    "Hi, thanks for calling. I'm an AI assistant. I'm having trouble pulling up our information right now — can I take your name and number so someone can call you back?",
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
  const memberId = memberIdForNumber(dialed)

  let vars = { ...FALLBACK, caller_phone: caller ?? '' }

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
          greeting_line: `Thanks for calling ${ctx.businessName}. I'm their AI assistant — I can take a message and have someone get back to you.`,
          caller_phone: caller ?? '',
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
          greeting_line: `Thanks for calling ${ctx.businessName}. I'm their AI assistant — how can I help you today?`,
          caller_phone: caller ?? '',
        }
      }
    } catch (err) {
      console.error('voice/context lookup failed:', err)
    }
  } else {
    console.warn('voice/context: no business mapped to dialed number', dialed)
  }

  // Flat AND wrapped, so it works regardless of which shape Telnyx reads.
  return NextResponse.json({ ...vars, dynamic_variables: vars })
}
