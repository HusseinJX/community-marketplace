import QRCode from 'qrcode'
import { getTicketByToken, ticketUrl } from '@/lib/tickets'

// The QR as a real hosted PNG.
//
// It exists for EMAIL: Gmail and friends strip data: URIs, so an inline QR has
// to be a fetchable image. The web ticket page renders its own QR client-side
// and doesn't need this.
//
// Serving it requires no auth beyond knowing the token, which is the same bar
// as viewing the ticket — but it is marked no-store so a shared proxy can't
// hand one person's ticket to the next requester.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ticket = await getTicketByToken(token)
  if (!ticket) return new Response('Not found', { status: 404 })

  const png = await QRCode.toBuffer(ticketUrl(ticket.token), {
    width: 600,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0c0a09', light: '#ffffff' },
  })

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
    },
  })
}
