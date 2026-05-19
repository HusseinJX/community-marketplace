import { NextResponse } from 'next/server'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { dispatchDelivery } from '@/lib/uber-direct'
import { getVendorProfile, updateOrderStatus, updateOrderUber, getVendorSettings } from '@/lib/vendor-connect'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { user } = await withAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  try {
    const body = await request.json()
    const { orderId }: { orderId: string } = body

    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.member_id !== profile.member_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!order.delivery_requested || !order.delivery_address || !order.uber_quote_id) {
      return NextResponse.json({ error: 'Delivery not requested or quote missing' }, { status: 400 })
    }

    // get vendor pickup info
    const connectorUrl = process.env.CONNECTOR_URL ?? ''
    let pickupAddress = ''
    let pickupPhone = ''
    let pickupName = ''

    const vendorSettings = await getVendorSettings(profile.member_id)
    if (vendorSettings?.uber_pickup_address) {
      pickupAddress = vendorSettings.uber_pickup_address
      pickupPhone = vendorSettings.uber_pickup_phone ?? ''
    } else {
      try {
        const memberRes = await fetch(`${connectorUrl}/.netlify/functions/marketplace-member?id=${order.member_id}`)
        const memberData = await memberRes.json()
        const p = memberData?.member?.profile ?? {}
        pickupAddress = p.businessAddress ?? p.address ?? ''
        pickupPhone = p.businessPhone ?? p.phone ?? ''
        pickupName = p.businessName ?? p.name ?? ''
      } catch { /* ignore */ }
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
      quoteId: order.uber_quote_id,
      pickupName,
      pickupAddress,
      pickupPhone,
      dropoff: order.delivery_address,
      items: manifest,
    })

    await updateOrderUber(order.id, result.delivery_id, result.tracking_url)
    return NextResponse.json({ success: true, trackingUrl: result.tracking_url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Dispatch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
