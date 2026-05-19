import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/uber-direct'
import { createClient } from '@supabase/supabase-js'

const STATUS_MAP: Record<string, string> = {
  pickup: 'dispatched',
  pickup_complete: 'dispatched',
  dropoff: 'dispatched',
  delivered: 'delivered',
  canceled: 'paid', // roll back to paid so vendor can retry
  returned: 'paid',
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('x-uber-signature') ?? ''

  if (!verifyWebhookSignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const deliveryId = event?.data?.id ?? event?.meta?.resource_id
  const uberStatus = event?.data?.status ?? event?.status

  if (!deliveryId || !uberStatus) {
    return NextResponse.json({ received: true })
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, delivery_address')
    .eq('uber_delivery_id', deliveryId)
    .single()

  if (!order) return NextResponse.json({ received: true })

  const newStatus = STATUS_MAP[uberStatus]
  if (newStatus && newStatus !== order.status) {
    await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    // SMS buyer when courier is on the way or delivered
    if (['dropoff', 'delivered'].includes(uberStatus)) {
      const { data: orderFull } = await supabase.from('orders').select('*').eq('id', order.id).single()
      const buyerPhone = orderFull?.delivery_address?.phone
      const trackingUrl = orderFull?.uber_tracking_url
      if (buyerPhone) {
        const connectorUrl = process.env.CONNECTOR_URL ?? ''
        const msg = uberStatus === 'delivered'
          ? `Your order ${order.order_number} has been delivered. Thanks for supporting local!`
          : `Your order ${order.order_number} is on the way!${trackingUrl ? ` Track here: ${trackingUrl}` : ''}`
        fetch(`${connectorUrl}/.netlify/functions/sms-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
          body: JSON.stringify({ to: buyerPhone, message: msg }),
        }).catch(e => console.error('SMS notify failed:', e))
      }
    }
  }

  return NextResponse.json({ received: true })
}
