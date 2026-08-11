import { NextResponse } from 'next/server'
import { getVendorSettings, getProductsByMember } from '@/lib/vendor-connect'
import { basketFulfillment, type BasketFulfillment } from '@/lib/product-kind'
import { printifyLinesFor } from '@/lib/printify-commerce'
import { effectiveDeliveryMode, selfDeliveryRules, pickupAddressFor } from '@/lib/fulfillment'

// What fulfillment options does this vendor actually offer?
//
// The checkout UI needs this BEFORE payment, so the buyer picks pickup or
// delivery up front and the fee lands in the PaymentIntent. Previously checkout
// asked nobody and showed a delivery modal to everyone after payment.
//
// Public: it returns only what a shopper is about to be shown anyway, and the
// pickup address is already on the vendor's public profile page.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params

  // What's in the basket decides whether there's anything to fulfil at all: a
  // basket of downloads has nothing to collect, and a service has nobody to
  // collect from. The names come in on the query string; prices are irrelevant
  // here, so nothing needs trusting.
  const names = new URL(request.url).searchParams.getAll('item')
  let basket: BasketFulfillment = 'physical'
  if (names.length > 0) {
    const catalog = await getProductsByMember(memberId)
    basket = basketFulfillment(
      names.map((n) => catalog.find((p) => p.name === n)?.kind)
    )
  }

  if (basket !== 'physical') {
    return NextResponse.json({
      basket,
      deliveryMode: 'none',
      deliveryAvailable: false,
      selfDelivery: null,
      pickupAddress: null,
    })
  }

  // A print-on-demand basket is produced and posted by Printify, so pickup and
  // vendor-driven delivery are both impossible for it regardless of what the
  // vendor set. Resolved per basket — one shop can sell both.
  const pod = names.length > 0 && !!(await printifyLinesFor(memberId, names.map((n) => ({ name: n, quantity: 1 }))))
  if (pod) {
    return NextResponse.json({
      basket: 'physical',
      deliveryMode: 'printify',
      deliveryAvailable: true,
      shippingOnly: true,
      selfDelivery: null,
      pickupAddress: null,
    })
  }

  const settings = await getVendorSettings(memberId)
  const mode = effectiveDeliveryMode(settings)
  const pickupAddress = await pickupAddressFor(memberId, settings)

  // Self-delivery rules go to the browser so the buyer sees the fee, the
  // free-over threshold and the minimum BEFORE typing an address — the fee is
  // knowable from the subtotal alone, and making someone fill in a form to
  // discover a $5 charge is the pattern this replaces. The server still
  // recomputes everything at payment; this copy is for display only.
  const self = mode === 'self' ? selfDeliveryRules(settings) : null

  return NextResponse.json({
    basket,
    deliveryMode: mode,
    // Kept for older clients that only understand a boolean.
    deliveryAvailable: mode !== 'none',
    selfDelivery: self
      ? {
          feeCents: self.feeCents,
          freeOverCents: self.freeOverCents,
          minOrderCents: self.minOrderCents,
          // Empty = anywhere. The list is the vendor's own advertised coverage,
          // so showing it is a feature, not a leak.
          zips: self.zips,
          notes: self.notes,
        }
      : null,
    // Null rather than '' so the UI can tell "no address on file" (show a
    // "the vendor will contact you" line) from a real address.
    pickupAddress: pickupAddress || null,
  })
}
