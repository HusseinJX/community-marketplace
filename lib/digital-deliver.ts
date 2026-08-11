import { getAllProductsByMember, type Order } from './vendor-connect'
import { grantDigitalAccess, downloadUrl, type GrantSpec } from './digital'
import { sendDigitalEmail } from './email'
import { kindOf } from './product-kind'

// Deliver the digital half of a paid order: grant access, email the links.
//
// Called from both the browser's confirm-payment and the Stripe webhook, and
// idempotent on the payment intent so whichever lands second changes nothing.

/**
 * IMPORTANT: this runs on EVERY paid order, not only `fulfillment_type =
 * 'digital'`.
 *
 * A mixed basket is classed as physical (the sandwich still has to change
 * hands), but the ebook in it must still arrive. Keying delivery off the
 * order's fulfillment type would silently swallow every digital item bought
 * alongside a physical one.
 */
export async function deliverDigitalItems(
  order: Pick<Order, 'id' | 'member_id' | 'items' | 'buyer_email' | 'payment_intent_id'>,
  opts: { buyerEmail?: string | null; attendeeId?: string | null; vendorName?: string | null } = {}
): Promise<number> {
  const email = opts.buyerEmail ?? order.buyer_email ?? null

  // getAllProductsByMember, NOT getProductsByMember: the latter filters to
  // active rows, so a vendor who took a product off sale between payment and
  // delivery would leave the buyer with nothing and no error — the loop below
  // simply wouldn't find it. They paid; whether it's still listed is irrelevant.
  const catalog = await getAllProductsByMember(order.member_id)
  const specs: GrantSpec[] = []
  for (const line of order.items ?? []) {
    const product = catalog.find((p) => p.name === line.name)
    if (!product || kindOf(product.kind) !== 'digital') continue
    // A digital product with no file attached can't be delivered. That should
    // be impossible (the vendor UI requires one), so it's logged loudly rather
    // than passed over in silence.
    if (!product.digital_file_path) {
      console.error(`digital product "${product.name}" (${product.id}) has no file — order ${order.id} undeliverable`)
      continue
    }
    specs.push({
      memberId: order.member_id,
      productId: product.id,
      productName: product.name,
      filePath: product.digital_file_path,
      fileName: product.digital_file_name ?? null,
      buyerEmail: email,
      attendeeId: opts.attendeeId ?? null,
      orderId: order.id,
      paymentIntentId: order.payment_intent_id,
    })
  }
  if (specs.length === 0) return 0

  const grants = await grantDigitalAccess(specs, order.payment_intent_id)

  void sendDigitalEmail({
    to: email,
    vendorName: opts.vendorName ?? null,
    items: grants.map((g) => ({
      productName: g.product_name,
      url: downloadUrl(g.token),
      fileName: g.file_name,
    })),
  }).catch((e) => console.error('digital email failed:', e))

  return grants.length
}
