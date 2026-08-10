import { NextResponse } from 'next/server'
import { getTicketByToken } from '@/lib/tickets'
import { getVendorEventById } from '@/lib/vendor-connect'

// A single ticket, addressed by its token.
//
// The token IS the credential — a guest buyer has no account to authenticate
// against, so holding the link is what proves entitlement, exactly like an
// unlisted video URL. That's why the token is 128 random bits and why it never
// appears in any list endpoint.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ticket = await getTicketByToken(token)
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const event = await getVendorEventById(ticket.event_id)
  return NextResponse.json({
    ticket: {
      token: ticket.token,
      code: ticket.code,
      typeName: ticket.ticket_type_name,
      status: ticket.status,
      checkedInAt: ticket.checked_in_at,
      buyerName: ticket.buyer_name,
      priceCents: ticket.price_cents,
    },
    event: event
      ? {
          id: event.id,
          title: event.title,
          date: event.event_date,
          time: event.event_time,
          location: event.location,
          hostName: event.member_name,
          memberId: event.member_id,
          poster: event.poster_image_url,
        }
      : null,
  })
}
