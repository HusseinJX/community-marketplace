import { NextResponse } from 'next/server'
import { dispatchDelivery, quoteDelivery, uberConfigured } from '@/lib/uber-direct'
import { resolveActor } from '@/lib/admin'
import { updateOrderUber, getVendorSettings } from '@/lib/vendor-connect'
import { pickupContactFor } from '@/lib/fulfillment'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

// Vendor hands a paid delivery order to an Uber courier.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId }: { orderId: string } = body
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const actor = await resolveActor()
    if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    if (actor.isDemo) return NextResponse.json({ error: 'Not available in demo' }, { status: 403 })

    if (!uberConfigured()) {
      return NextResponse.json({ error: 'Delivery is not available.' }, { status: 503 })
    }

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.member_id !== actor.memberId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // The vendor's own opt-out, enforced on the paid path — it wasn't before.
    const settings = await getVendorSettings(actor.memberId)
    if (!settings?.uber_direct_enabled) {
      return NextResponse.json({ error: 'Delivery is switched off for your shop.' }, { status: 400 })
    }

    if (order.fulfillment_type !== 'delivery' || !order.delivery_address) {
      return NextResponse.json({ error: 'This is a pickup order.' }, { status: 400 })
    }
    if (order.uber_delivery_id) {
      return NextResponse.json({ error: 'Already dispatched.' }, { status: 409 })
    }

    const { address: pickupAddress, phone: pickupPhone, name: pickupName } =
      await pickupContactFor(actor.memberId)
    if (!pickupAddress) {
      return NextResponse.json(
        { error: 'Add a pickup address in Shop & delivery first.' },
        { status: 400 }
      )
    }

    // ── Re-quote. Uber quotes expire after 15 minutes:
    // https://developer.uber.com/docs/deliveries/guides/authentication
    // We quote at checkout and dispatch whenever the vendor marks the order
    // ready — minutes to hours later — so order.uber_quote_id is essentially
    // always dead by now, and dispatching with it would fail every time.
    const fresh = await quoteDelivery(pickupAddress, order.delivery_address)

    // The buyer already paid delivery_fee_charged_cents at checkout. We don't
    // re-charge them for a courier price that moved after they bought — the
    // platform absorbs the delta. Logged so the exposure is visible rather than
    // silently eaten.
    const charged = order.delivery_fee_charged_cents ?? order.delivery_fee_cents ?? 0
    const delta = fresh.fee_cents - charged
    if (delta !== 0) {
      console.warn(
        `[uber] order ${order.order_number}: re-quote ${fresh.fee_cents}¢ vs charged ${charged}¢ ` +
        `→ platform absorbs ${delta > 0 ? '+' : ''}${delta}¢`
      )
    }

    const manifest = (order.items as Array<{ name: string; qty: number; price_cents: number }>).map(i => ({
      name: i.name,
      quantity: i.qty,
      size: 'small' as const,
      price: Math.round(i.price_cents / 100),
    }))

    const result = await dispatchDelivery({
      orderId: order.id,
      orderNumber: order.order_number,
      quoteId: fresh.quote_id,
      pickupName,
      pickupAddress,
      pickupPhone,
      dropoff: order.delivery_address,
      items: manifest,
    })

    // Record what the courier actually cost, leaving delivery_fee_charged_cents
    // (the buyer's receipt) untouched.
    await supabase
      .from('orders')
      .update({
        uber_quote_id: fresh.quote_id,
        delivery_fee_cents: fresh.fee_cents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    await updateOrderUber(order.id, result.delivery_id, result.tracking_url)
    return NextResponse.json({ success: true, trackingUrl: result.tracking_url })
  } catch (error: unknown) {
    console.error('uber dispatch error:', error)
    const message = error instanceof Error ? error.message : 'Dispatch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
