import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getAcceptedLineup } from '@/lib/collab-network'
import { getEventMessages, postEventMessage, getMemberContacts, type EventChannel } from '@/lib/event-comms'
import { sendSmsBatch } from '@/lib/sms'
import { sendEmailBatch } from '@/lib/email'
import { isDemoMode } from '@/lib/demo-admin'
import { demoMemberId } from '@/lib/demo-server'
import { demoEventMessages, isDemoEventId } from '@/lib/demo-organize'

// Host or an accepted lineup member may read/post the event thread.
async function authorize(eventId: string, requested?: string | null) {
  const event = await getVendorEventById(eventId)
  if (!event) return { error: 'Event not found' as const, status: 404 }
  const actor = await resolveActor(requested)
  if (!actor) return { error: 'Unauthorized' as const, status: 401 }
  const isHost = actor.memberId === event.member_id
  if (!isHost) {
    const lineup = await getAcceptedLineup(eventId)
    if (!lineup.some((i) => i.to_id === actor.memberId)) {
      return { error: 'Unauthorized' as const, status: 403 }
    }
  }
  return { event, actor, isHost }
}

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const requested = new URL(req.url).searchParams.get('memberId')
  if (isDemoMode() && isDemoEventId(eventId)) {
    return NextResponse.json({ messages: demoEventMessages(eventId, await demoMemberId()) })
  }
  const a = await authorize(eventId, requested)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  return NextResponse.json({ messages: await getEventMessages(eventId) })
}

// POST — post to the thread, optionally blasting SMS/email to the lineup.
// Body: { text, channels?: ('chat'|'sms'|'email')[], memberId? }
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const body = await req.json().catch(() => ({}))
  if (isDemoMode() && isDemoEventId(eventId)) return NextResponse.json({ ok: true, demo: true })
  const a = await authorize(eventId, body.memberId)
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status })
  const { event, actor, isHost } = a

  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const channels: EventChannel[] = Array.isArray(body.channels) ? body.channels : ['chat']
  const senderName = isHost ? event.member_name : null

  // Always record the in-app message.
  const message = await postEventMessage({
    event_id: eventId,
    sender_id: actor.memberId,
    sender_name: senderName,
    text,
    channel: 'chat',
  })

  // Blasts are host-only.
  const blast: Record<string, number> = {}
  if (isHost && (channels.includes('sms') || channels.includes('email'))) {
    const lineup = await getAcceptedLineup(eventId)
    const contacts = await getMemberContacts(lineup.map((i) => i.to_id))
    const prefix = `[${event.title}] `

    if (channels.includes('sms')) {
      const phones = contacts.map((c) => c.phone).filter((p): p is string => !!p)
      const sent = await sendSmsBatch(phones, prefix + text)
      blast.sms = sent
      await postEventMessage({
        event_id: eventId, sender_id: actor.memberId, sender_name: senderName,
        text, channel: 'sms', recipients: sent,
      })
    }
    if (channels.includes('email')) {
      const emails = contacts.map((c) => c.email).filter((e): e is string => !!e)
      const sent = await sendEmailBatch(emails, `Update: ${event.title}`, text)
      blast.email = sent
      await postEventMessage({
        event_id: eventId, sender_id: actor.memberId, sender_name: senderName,
        text, channel: 'email', recipients: sent,
      })
    }
  }

  return NextResponse.json({ message, blast })
}
