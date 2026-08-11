import { NextResponse } from 'next/server'
import { stripe, calculateFees } from '@/lib/stripe-server'
import { getVendorConnectAccount, getVendorSettings, getProductsByMember, type DeliveryAddressJson } from '@/lib/vendor-connect'
import { effectiveDeliveryMode, selfDeliveryRules, quoteSelfDelivery } from '@/lib/fulfillment'
import { basketFulfillment } from '@/lib/product-kind'
import { printifyLinesFor, quotePrintifyShipping } from '@/lib/printify-commerce'
import { rateLimit } from '@/lib/rate-limit'

interface CartItem {
  name: string
  memberId: string
  price: number
  quantity: number
}

// Creates the PaymentIntent for one vendor's basket.
//
// The delivery fee is charged HERE, at payment time. It used to be quoted after
// the buyer had already paid (the post-payment DeliveryRequestModal), which
// meant it was only ever stored and displayed — never collected — so the
// platform silently ate every courier fee.
//
// Money split for a delivery order:
//   amount               = items + deliveryFee     (what the buyer pays)
//   application_fee      = 5% of items + deliveryFee   (what the platform keeps)
//   vendor receives      = items - 5% of items
// The delivery fee routes to the PLATFORM, not the vendor, because the platform
// is who pays Uber. Taking 5% of the courier fee would be taxing a pass-through,
// so the platform cut is computed on items only.
export async function POST(request: Request) {
  try {
    // Checkout is guest-friendly (no sign-in required), so the guard is per-IP.
    const limited = rateLimit({ req: request, name: 'checkout-pi', id: null, limit: 20, windowMs: 60_000, ipLimit: 20 })
    if (limited) return limited

    const body = await request.json()
    const {
      items,
      memberId,
      fulfillmentType = 'pickup',
      deliveryAddress,
      deliveryFeeCents,
      uberQuoteId,
    }: {
      items: CartItem[]
      memberId: string
      fulfillmentType?: 'pickup' | 'delivery' | 'digital' | 'service'
      deliveryAddress?: DeliveryAddressJson
      deliveryFeeCents?: number
      uberQuoteId?: string
    } = body

    if (!items?.length || !memberId) {
      return NextResponse.json({ error: 'items and memberId are required' }, { status: 400 })
    }

    const vendorAccount = await getVendorConnectAccount(memberId)

    if (!vendorAccount || !vendorAccount.stripe_account_id) {
      return NextResponse.json(
        { error: 'STRIPE_CONNECT_NOT_SETUP', message: 'This vendor has not set up payments yet.' },
        { status: 400 }
      )
    }

    if (vendorAccount.status !== 'active') {
      return NextResponse.json(
        { error: 'STRIPE_CONNECT_NOT_SETUP', message: 'This vendor\'s payment account is not yet active.' },
        { status: 400 }
      )
    }

    // The catalog is the authority on both price and KIND, so it's fetched
    // before anything is decided. What's in the basket determines what can be
    // fulfilled — a basket of downloads cannot be a delivery no matter what the
    // client asks for, and a client claiming "digital" for a sandwich must not
    // get out of arranging a handover.
    const catalog = await getProductsByMember(memberId)
    const basket = basketFulfillment(items.map((i) => catalog.find((p) => p.name === i.name)?.kind))

    // A print-on-demand basket is printed and posted by Printify, so it can be
    // neither collected from a counter nor driven over by the vendor. Resolved
    // per BASKET (one shop can sell both) and BEFORE the fulfillment choice,
    // because it OVERRIDES that choice.
    //
    // This must not be computed only for baskets the client already called a
    // delivery: `fulfillmentType` comes from the browser, so a request naming
    // 'pickup' over POD items would otherwise skip postage entirely and leave
    // the vendor owing a customer an item Printify ships — with the postage
    // never collected. Same rule as prices: the basket decides, not the caller.
    const isPod = !!(await printifyLinesFor(memberId, items.map((i) => ({ name: i.name, quantity: i.quantity }))))

    // Delivery is only real when the vendor offers it in a way that can
    // actually happen. Enforced server-side: the buyer's client can't talk us
    // into a delivery order against a pickup-only vendor.
    const fulfillment: 'pickup' | 'delivery' | 'digital' | 'service' =
      basket === 'digital'
        ? 'digital'
        : basket === 'service'
          ? 'service'
          : isPod || fulfillmentType === 'delivery'
            ? 'delivery'
            : 'pickup'
    const settings = fulfillment === 'delivery' && !isPod ? await getVendorSettings(memberId) : null
    const mode = isPod ? 'printify' : effectiveDeliveryMode(settings)

    if (fulfillment === 'delivery') {
      if (mode === 'none') {
        return NextResponse.json(
          { error: 'DELIVERY_UNAVAILABLE', message: 'This vendor is pickup only.' },
          { status: 400 }
        )
      }
      if (!deliveryAddress?.street) {
        return NextResponse.json({ error: 'Delivery needs an address.' }, { status: 400 })
      }
      // Only the courier path needs a quote id — a self-delivery fee comes from
      // the vendor's own rules and is computed below, not quoted by anyone.
      if (mode === 'uber' && (!uberQuoteId || typeof deliveryFeeCents !== 'number')) {
        return NextResponse.json(
          { error: 'Delivery needs an address and a fresh quote.' },
          { status: 400 }
        )
      }
    }

    // SECURITY: never trust client-supplied prices. Re-price every line from the
    // vendor's ACTIVE catalog (server-side, cents) and reject anything not
    // currently on sale — otherwise a tampered `items[].price` lets a buyer pay
    // any amount. Cart lines match a product by name within the member (the cart
    // id is `${memberId}__${productName}`).
    const priced = items.map((item) => {
      const product = catalog.find((p) => p.name === item.name)
      if (!product) return null
      const quantity = Math.min(999, Math.max(1, Math.floor(item.quantity || 1)))
      return { name: product.name, price_cents: product.price, quantity }
    })
    if (priced.some((p) => p === null)) {
      return NextResponse.json(
        { error: 'ITEM_UNAVAILABLE', message: 'One or more items are no longer available at the listed price.' },
        { status: 400 }
      )
    }
    const pricedItems = priced as { name: string; price_cents: number; quantity: number }[]
    const itemsCents = pricedItems.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)
    // Trust the server's own arithmetic for the fee, never the client's number:
    // deliveryFeeCents arrives from the browser, so clamp it to >= 0 and only
    // honour it on a delivery order.
    let feeCents = 0
    if (fulfillment === 'delivery') {
      if (mode === 'printify') {
        // Postage comes from Printify at payment time. Quoting it afterwards is
        // the exact bug that made the platform eat every courier fee — here it
        // would be the VENDOR eating it, since Printify bills them for postage.
        try {
          const postage = await quotePrintifyShipping(
            memberId,
            items.map((i) => ({ name: i.name, quantity: i.quantity })),
            deliveryAddress!,
            null
          )
          if (postage == null) {
            return NextResponse.json(
              { error: 'SHIPPING_UNAVAILABLE', message: 'Could not work out postage for that address.' },
              { status: 409 }
            )
          }
          feeCents = postage
        } catch (e) {
          console.error('printify shipping quote failed:', e)
          return NextResponse.json(
            { error: 'SHIPPING_UNAVAILABLE', message: 'Could not work out postage for that address. Please check it and try again.' },
            { status: 409 }
          )
        }
      } else if (mode === 'self') {
        // Recomputed from the vendor's rules — the client's number is never
        // trusted, and here it also decides whether the order clears a minimum
        // or earns free delivery.
        const quote = quoteSelfDelivery(selfDeliveryRules(settings), itemsCents, deliveryAddress?.zip)
        if (!quote.ok) {
          return NextResponse.json({ error: quote.reason, message: quote.message }, { status: 409 })
        }
        feeCents = quote.feeCents
      } else {
        feeCents = Math.max(0, Math.round(deliveryFeeCents ?? 0))
      }
    }
    const totalCents = itemsCents + feeCents

    // Platform cut is on items only — the delivery fee is a pass-through either
    // way, so it is never taxed.
    const { platformFee, vendorAmount } = calculateFees(itemsCents)

    // WHO KEEPS THE DELIVERY FEE, and it is not cosmetic. The rule is simply
    // "whoever pays the carrier keeps the fee":
    //   uber     → the PLATFORM pays the courier, so the fee is added to the
    //              application fee and stays with us.
    //   self     → the VENDOR is the courier, so it flows through to them.
    //   printify → PRINTIFY bills the VENDOR for production and postage, so the
    //              postage must reach the vendor too — otherwise they pay it
    //              twice, once to us and once to Printify.
    // Adding it in every branch would silently skim every vendor who isn't
    // using our courier, which is exactly the bug this comment exists to stop.
    const applicationFee = mode === 'uber' ? platformFee + feeCents : platformFee

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: vendorAccount.stripe_account_id,
      },
      metadata: {
        memberId,
        items: JSON.stringify(pricedItems.map(i => ({ name: i.name, qty: i.quantity, price_cents: i.price_cents }))),
        subtotal_cents: String(itemsCents),
        platform_fee_cents: String(platformFee),
        vendor_amount_cents: String(vendorAmount),
        fulfillment_type: fulfillment,
        delivery_provider: fulfillment === 'delivery' ? mode : '',
        delivery_fee_cents: String(feeCents),
        uber_quote_id: mode === 'uber' ? (uberQuoteId ?? '') : '',
        // Stripe metadata values cap at 500 chars — an address is well under.
        delivery_address: fulfillment === 'delivery' ? JSON.stringify(deliveryAddress) : '',
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents,
      itemsCents,
      deliveryFeeCents: feeCents,
      platformFee,
      vendorAmount,
    })
  } catch (error: unknown) {
    console.error('create-payment-intent error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create payment intent'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
