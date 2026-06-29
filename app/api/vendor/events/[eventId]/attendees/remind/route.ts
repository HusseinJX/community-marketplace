import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getVendorEventById } from '@/lib/vendor-connect'
import { getAttendees } from '@/lib/attendees'
import { sendSmsBatch } from '@/lib/sms'

// A contact is text-reachable if it has at least 10 digits (a phone). Emails are
// skipped — email reminders need Resend, which isn't wired in prod.
function isPhone(contact: string | null): boolean {
  return !!contact && (contact.replace(/\D/g, '').length >= 10)
}

// POST — text every attendee (who left a phone) a reminder. Host only.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  const event = await getVendorEventById(eventId)
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const actor = await resolveActor(event.member_id)
  if (!actor || actor.memberId !== event.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const attendees = await getAttendees(eventId)
  const phones = attendees.map((a) => a.attendee_contact).filter(isPhone) as string[]
  if (phones.length === 0) {
    return NextResponse.json({ sent: 0, withPhone: 0, total: attendees.length })
  }

  const when = [event.event_date, event.event_time].filter(Boolean).join(' ')
  const body = await req.json().catch(() => ({}))
  const custom = String(body.message ?? '').trim()
  const message =
    custom ||
    `Reminder: "${event.title}"${when ? ` is on ${when}` : ' is coming up'}. See you there! — ${event.member_name || 'your host'} via WhatsLocal`

  const sent = await sendSmsBatch(phones, message)
  return NextResponse.json({ sent, withPhone: phones.length, total: attendees.length })
}
