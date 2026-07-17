import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { quoteDelivery, uberConfigured, type DeliveryAddress } from '@/lib/uber-direct'
import { getVendorSettings } from '@/lib/vendor-connect'
import { pickupAddressFor } from '@/lib/fulfillment'
import { rateLimit } from '@/lib/rate-limit'

// Price a delivery for a vendor + dropoff, BEFORE the order exists.
//
// This used to take an `orderId` with no auth at all and look the order up with
// the anon key — so anyone could probe someone else's order. Keying on memberId
// removes that surface entirely: there is no order yet, and a quote between a
// public business address and an address the caller supplied leaks nothing.
//
// Rate-limited because each call is a billed Uber request. Shoppers can check
// out signed-out, so the limiter falls back to per-IP.
export async function POST(request: Request) {
  const { userId } = await auth()
  const limited = rateLimit({
    req: request,
    name: 'uber-quote',
    id: userId,
    limit: 20,
    windowMs: 60_000,
  })
  if (limited) return limited

  try {
    const body = await request.json()
    const { memberId, dropoff }: { memberId: string; dropoff: DeliveryAddress } = body

    if (!memberId || !dropoff?.street || !dropoff?.city) {
      return NextResponse.json({ error: 'memberId and dropoff address required' }, { status: 400 })
    }

    if (!uberConfigured()) {
      return NextResponse.json({ error: 'DELIVERY_UNAVAILABLE' }, { status: 503 })
    }

    // The vendor's opt-out is enforced here, not just in the UI — quoting a
    // delivery for a pickup-only vendor offers the buyer something the vendor
    // never agreed to. The paid path used to skip this check entirely.
    const settings = await getVendorSettings(memberId)
    if (!settings?.uber_direct_enabled) {
      return NextResponse.json({ error: 'DELIVERY_UNAVAILABLE' }, { status: 400 })
    }

    const pickupAddress = await pickupAddressFor(memberId, settings)
    if (!pickupAddress) {
      return NextResponse.json({ error: 'Vendor pickup address not found' }, { status: 400 })
    }

    const quote = await quoteDelivery(pickupAddress, dropoff)
    // Don't echo pickupAddress back — the buyer doesn't need the vendor's
    // address for a delivery, and the old route returned it to any caller.
    return NextResponse.json({ quote })
  } catch (error: unknown) {
    // Log the detail, return a generic message. This is a BUYER-facing route:
    // the raw error is Uber's (e.g. "auth failed: 401 invalid_client"), which
    // means nothing to a shopper and exposes our integration's internals.
    console.error('uber quote error:', error)
    return NextResponse.json(
      { error: "We couldn't price a delivery to that address right now." },
      { status: 500 }
    )
  }
}
