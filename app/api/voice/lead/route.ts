import { NextResponse } from 'next/server'
import { createConversation, appendMessages, createLead } from '@/lib/vendor-connect'
import { memberIdForNumber, normalizePhone } from '@/lib/business-phone'
import { notifyMemberUserSafe } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Telnyx webhook TOOL: the phone agent calls this when it takes a message —
// the caller wants a callback, or asked something the business context can't
// answer. Writes to the SAME tables as the on-profile chat agent
// (chat_conversations / chat_messages / chat_leads), so a phone call shows up
// in the vendor's Messages inbox next to their web conversations rather than
// in a separate phone silo.
//
// Auth: shared-secret header (webhook tools CAN set headers, unlike the
// dynamic-variables webhook).

interface Body {
  member_id?: string
  dialed_number?: string
  /** The business's own number, minted by /api/voice/context and echoed back. */
  business_number?: string
  caller_phone?: string
  name?: string
  contact?: string
  message?: string
}

export async function POST(req: Request) {
  const secret = process.env.VOICE_TOOL_SECRET
  if (secret && req.headers.get('x-voice-tool-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body

  // Resolve through the routing table wherever possible: the model can
  // hallucinate a member_id, whereas a number resolves to exactly one business.
  //
  // business_number comes FIRST because it is the only one that survives call
  // forwarding — on a forwarded call `dialed_number` is our shared number, so
  // trusting it would file the message under whichever business owns that
  // number rather than the one the caller actually rang. /api/voice/context
  // mints business_number from the SIP Diversion header and hands it to the
  // model, so it is our value coming home, not the model's invention.
  const memberId =
    memberIdForNumber(body.business_number) ||
    memberIdForNumber(body.dialed_number) ||
    body.member_id
  if (!memberId) {
    return NextResponse.json({ ok: false, error: 'unknown_business' }, { status: 400 })
  }

  const caller = normalizePhone(body.caller_phone)
  const contact = body.contact?.trim() || caller || ''
  const message = body.message?.trim() || 'Caller asked for a callback.'
  const name = body.name?.trim() || null

  try {
    // One conversation per captured message keeps the inbox readable — each
    // phone call that produced a lead reads as its own thread.
    const conversationId = await createConversation(memberId)
    await appendMessages(conversationId, memberId, [
      {
        role: 'user',
        content: `📞 Phone call${caller ? ` from ${caller}` : ''}${name ? ` — ${name}` : ''}\n\n${message}`,
      },
      {
        role: 'assistant',
        content: contact
          ? `Took a message and confirmed we'd follow up at ${contact}.`
          : 'Took a message for the business.',
      },
    ])
    await createLead({ memberId, conversationId, name, contact: contact || null, message })

    void notifyMemberUserSafe(memberId, {
      title: 'New phone message',
      body: `${name || caller || 'A caller'}: ${message.slice(0, 120)}`,
      url: '/vendor/messages',
    })

    return NextResponse.json({ ok: true, result: 'Message saved. The business will follow up.' })
  } catch (err) {
    console.error('voice/lead failed:', err)
    // Tell the model it failed so it can say so honestly instead of promising
    // a callback that will never happen.
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  }
}
