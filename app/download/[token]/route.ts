import { NextResponse } from 'next/server'
import { redeemGrant } from '@/lib/digital'
import { rateLimit } from '@/lib/rate-limit'

// The emailed download link.
//
// A route rather than a page: the buyer clicked "Download", so the correct
// response is the file starting to download, not a page with another button on
// it. Failures are the only thing worth rendering, and they render as plain
// text because this is reached straight from an email client.
//
// The token IS the credential — a guest buyer has no account — so this is
// deliberately unauthenticated, exactly like a ticket link. What protects the
// file is that the token is 128 random bits and the object behind it is private:
// every redemption mints a fresh short-lived signed URL, so nothing durable
// escapes even if the link is forwarded.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Per-IP guard: this is the one endpoint where guessing has a payoff.
  const limited = rateLimit({ req: request, name: 'digital-download', id: null, limit: 30, windowMs: 60_000, ipLimit: 30 })
  if (limited) return limited

  const result = await redeemGrant(token)
  if (!result.ok) {
    return new NextResponse(result.message, {
      status: result.reason === 'not_found' ? 404 : result.reason === 'missing_file' ? 503 : 410,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  // 302, never 301: the signed URL expires in minutes, and a permanent redirect
  // would be cached by the browser and then fail forever on the next click.
  return NextResponse.redirect(result.url, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
