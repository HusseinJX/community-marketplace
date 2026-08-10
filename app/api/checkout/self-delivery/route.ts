import { NextResponse } from 'next/server'
import { getVendorSettings, getProductsByMember } from '@/lib/vendor-connect'
import { effectiveDeliveryMode, selfDeliveryRules, quoteSelfDelivery } from '@/lib/fulfillment'
import { rateLimit } from '@/lib/rate-limit'

interface Line {
  name: string
  quantity: number
}

// Price a vendor-driven delivery before payment.
//
// The Uber twin (/api/uber/quote) exists because a courier fee can only come
// from Uber. This one calls nothing and costs nothing — the fee is the vendor's
// own rule applied to their own catalog — so it's a plain arithmetic endpoint
// that happens to run where the numbers can be trusted.
//
// The subtotal is recomputed from the vendor's ACTIVE catalog rather than taken
// from the request, because the free-over threshold and the minimum order are
// both decided by it: a client that could name its own subtotal could talk
// itself past a $50 minimum or into free delivery.
export async function POST(request: Request) {
  const limited = rateLimit({ req: request, name: 'self-delivery-quote', id: null, limit: 30, windowMs: 60_000, ipLimit: 30 })
  if (limited) return limited

  try {
    const { memberId, items, zip }: { memberId: string; items: Line[]; zip?: string } = await request.json()
    if (!memberId || !Array.isArray(items)) {
      return NextResponse.json({ error: 'memberId and items are required' }, { status: 400 })
    }

    const settings = await getVendorSettings(memberId)
    if (effectiveDeliveryMode(settings) !== 'self') {
      return NextResponse.json({ error: 'DELIVERY_UNAVAILABLE' }, { status: 400 })
    }

    const catalog = await getProductsByMember(memberId)
    let subtotalCents = 0
    for (const item of items) {
      const product = catalog.find((p) => p.name === item.name)
      if (!product) {
        return NextResponse.json({ error: 'ITEM_UNAVAILABLE', message: 'One or more items are no longer available.' }, { status: 400 })
      }
      subtotalCents += product.price * Math.min(999, Math.max(1, Math.floor(item.quantity || 1)))
    }

    const quote = quoteSelfDelivery(selfDeliveryRules(settings), subtotalCents, zip)
    if (!quote.ok) {
      return NextResponse.json({ error: quote.reason, message: quote.message, shortfallCents: quote.shortfallCents }, { status: 409 })
    }
    return NextResponse.json({ feeCents: quote.feeCents, free: quote.free, subtotalCents })
  } catch (error: unknown) {
    console.error('self-delivery quote error:', error)
    return NextResponse.json({ error: 'Could not price that delivery.' }, { status: 500 })
  }
}
