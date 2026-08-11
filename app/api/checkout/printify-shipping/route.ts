import { NextResponse } from 'next/server'
import { quotePrintifyShipping } from '@/lib/printify-commerce'
import { rateLimit } from '@/lib/rate-limit'
import type { DeliveryAddressJson } from '@/lib/vendor-connect'

// Postage for a print-on-demand basket, before payment.
//
// Rate-limited because unlike the self-delivery quote (pure arithmetic) each
// call is a real request to Printify on the vendor's token. Keyed on memberId
// with no order in existence yet, so there is nothing here to hijack — the same
// reasoning that de-fanged the old Uber quote route.
export async function POST(request: Request) {
  const limited = rateLimit({ req: request, name: 'printify-shipping', id: null, limit: 20, windowMs: 60_000, ipLimit: 20 })
  if (limited) return limited

  try {
    const {
      memberId,
      items,
      address,
    }: { memberId: string; items: { name: string; quantity: number }[]; address: DeliveryAddressJson } =
      await request.json()

    if (!memberId || !Array.isArray(items) || !address?.street || !address?.zip) {
      return NextResponse.json({ error: 'memberId, items and a full address are required' }, { status: 400 })
    }

    const feeCents = await quotePrintifyShipping(memberId, items, address, null)
    if (feeCents == null) {
      return NextResponse.json(
        { error: 'NOT_POD', message: "These items aren't posted by the maker." },
        { status: 400 }
      )
    }
    return NextResponse.json({ feeCents })
  } catch (error: unknown) {
    // Printify's own words ("invalid zip", "unsupported country") mean nothing
    // to a shopper and expose the integration, so they stay in the log.
    console.error('printify shipping quote failed:', error)
    return NextResponse.json(
      { error: 'SHIPPING_UNAVAILABLE', message: 'Could not work out postage for that address. Please check it and try again.' },
      { status: 502 }
    )
  }
}
