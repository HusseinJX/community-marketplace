import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { getBookingsForMember, setBookingStatus, getBooking, bookingWhen, releaseSquareSlot, type BookingStatus } from '@/lib/bookings'
import { sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/seo'

// The business's side: see requests, agree or decline.

const ANSWERABLE: BookingStatus[] = ['confirmed', 'declined', 'completed', 'cancelled']

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('memberId')
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  return NextResponse.json({ bookings: await getBookingsForMember(actor.memberId) })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}))
  const actor = await resolveActor(body.memberId ?? null)
  if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ demo: true })

  const id = String(body.id ?? '')
  const status = String(body.status ?? '') as BookingStatus
  if (!id || !ANSWERABLE.includes(status)) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 })
  }

  const before = await getBooking(id)
  const booking = await setBookingStatus(id, actor.memberId, status, {
    // Confirming may name a different time from the one asked for — "not
    // Thursday, but Friday at 2" is the commonest real answer.
    confirmedDate: body.confirmedDate ?? before?.requested_date ?? null,
    confirmedTime: body.confirmedTime ?? before?.requested_time ?? null,
    vendorNote: body.vendorNote ?? null,
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Declining or cancelling a booking that Square is holding has to release the
  // slot, or the business keeps a gap for someone who isn't coming.
  if (status === 'declined' || status === 'cancelled') void releaseSquareSlot(booking)

  // Tell the customer. A request answered into silence is the same as one that
  // was never answered — and this is the half the prototype never had.
  if ((status === 'confirmed' || status === 'declined') && booking.customer_email) {
    const confirmed = status === 'confirmed'
    const when = bookingWhen(booking)
    const note = booking.vendor_note
      ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f5f5f4;border-radius:10px;color:#44403c">${escapeHtml(booking.vendor_note)}</p>`
      : ''
    void sendEmail({
      to: booking.customer_email,
      subject: confirmed ? `You're booked in — ${when}` : 'About your booking request',
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1c1917;max-width:480px">
        <p style="margin:0 0 8px;font-size:18px;font-weight:600">${confirmed ? "You're booked in" : "They can't make that time"}</p>
        <p style="margin:0 0 16px;color:#57534e">${
          confirmed
            ? `${escapeHtml(booking.service_name || 'Your booking')} — <strong>${escapeHtml(when)}</strong>.`
            : 'Unfortunately that slot has not worked out. You can ask for another time.'
        }</p>
        ${note}
        <p style="margin:0 0 24px"><a href="${SITE_URL}/members/${encodeURIComponent(booking.member_id)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">View the business</a></p>
        <p style="margin:0;color:#a8a29e;font-size:13px">WhatsLocal AI</p>
      </div>`,
      text: confirmed
        ? `You're booked in: ${booking.service_name || 'your booking'} — ${when}.${booking.vendor_note ? `\n\n"${booking.vendor_note}"` : ''}`
        : `They can't make that time.${booking.vendor_note ? `\n\n"${booking.vendor_note}"` : ''}\n\nAsk for another: ${SITE_URL}/members/${booking.member_id}`,
    }).catch((e) => console.error('booking email failed:', e))
  }

  return NextResponse.json({ booking })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
