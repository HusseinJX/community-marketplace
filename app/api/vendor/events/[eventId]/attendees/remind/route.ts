import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { isDemoMode } from '@/lib/demo-admin'
import { demoAttendees, isDemoEventId } from '@/lib/demo-organize'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getAttendees } from '@/lib/attendees'
import { sendSmsBatch } from '@/lib/sms'
import { sendEmailBatch } from '@/lib/email'

// A contact is text-reachable if it has at least 10 digits (a phone).
function isPhone(contact: string | null): boolean {
  return !!contact && contact.replace(/\D/g, '').length >= 10
}
function isEmail(contact: string | null): boolean {
  return !!contact && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim())
}

// POST — blast attendees. Body: { message?, channels?: ('sms'|'email')[] }.
// Defaults to SMS-only with a canned reminder (back-compat with the old button).
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const body = await req.json().catch(() => ({}))
  const channels: string[] = Array.isArray(body.channels) && body.channels.length ? body.channels : ['sms']

  if (isDemoMode() && isDemoEventId(eventId)) {
    const list = demoAttendees(eventId).attendees
    const withPhone = list.filter((a) => isPhone(a.attendee_contact)).length
    const withEmail = list.filter((a) => isEmail(a.attendee_contact)).length
    return NextResponse.json({
      sent: channels.includes('sms') ? withPhone : 0,
      emailed: channels.includes('email') ? withEmail : 0,
      withPhone,
      withEmail,
      total: list.length,
      demo: true,
    })
  }

  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const attendees = await getAttendees(eventId)
  const phones = attendees.map((a) => a.attendee_contact).filter(isPhone) as string[]
  const emails = attendees.map((a) => a.attendee_contact).filter(isEmail) as string[]

  const when = [event.event_date, event.event_time].filter(Boolean).join(' ')
  const custom = String(body.message ?? '').trim()
  const message =
    custom ||
    `Reminder: "${event.title}"${when ? ` is on ${when}` : ' is coming up'}. See you there! — ${event.member_name || 'your host'} via WhatsLocal`

  let sent = 0
  let emailed = 0
  if (channels.includes('sms') && phones.length) sent = await sendSmsBatch(phones, message)
  if (channels.includes('email') && emails.length) emailed = await sendEmailBatch(emails, `Update: ${event.title}`, message)

  return NextResponse.json({ sent, emailed, withPhone: phones.length, withEmail: emails.length, total: attendees.length })
}
