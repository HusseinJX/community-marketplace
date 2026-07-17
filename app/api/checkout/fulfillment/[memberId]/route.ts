import { NextResponse } from 'next/server'
import { deliveryAvailableFor, pickupAddressFor } from '@/lib/fulfillment'

// What fulfillment options does this vendor actually offer?
//
// The checkout UI needs this BEFORE payment, so the buyer picks pickup or
// delivery up front and the courier fee lands in the PaymentIntent. Previously
// checkout asked nobody and showed a delivery modal to everyone after payment.
//
// Public: it returns only what a shopper is about to be shown anyway, and the
// pickup address is already on the vendor's public profile page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params

  const [deliveryAvailable, pickupAddress] = await Promise.all([
    deliveryAvailableFor(memberId),
    pickupAddressFor(memberId),
  ])

  return NextResponse.json({
    deliveryAvailable,
    // Null rather than '' so the UI can tell "no address on file" (show a
    // "the vendor will contact you" line) from a real address.
    pickupAddress: pickupAddress || null,
  })
}
