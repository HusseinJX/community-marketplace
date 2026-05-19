import { NextResponse } from 'next/server'
import { quoteDelivery, DeliveryAddress } from '@/lib/uber-direct'
import { getOrdersByMember, getVendorConnectAccount } from '@/lib/vendor-connect'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, dropoff }: { orderId: string; dropoff: DeliveryAddress } = body

    if (!orderId || !dropoff?.street || !dropoff?.city) {
      return NextResponse.json({ error: 'orderId and dropoff address required' }, { status: 400 })
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // get vendor pickup address from Firestore via connector API
    const connectorUrl = process.env.CONNECTOR_URL ?? ''
    let pickupAddress = ''
    try {
      const memberRes = await fetch(
        `${connectorUrl}/.netlify/functions/marketplace-member?id=${order.member_id}`
      )
      const memberData = await memberRes.json()
      const profile = memberData?.member?.profile ?? {}
      pickupAddress = profile.businessAddress ?? profile.address ?? ''
    } catch {
      // fall through — quote will fail gracefully if empty
    }

    if (!pickupAddress) {
      return NextResponse.json({ error: 'Vendor pickup address not found' }, { status: 400 })
    }

    const quote = await quoteDelivery(pickupAddress, dropoff)
    return NextResponse.json({ quote, pickupAddress })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Quote failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
