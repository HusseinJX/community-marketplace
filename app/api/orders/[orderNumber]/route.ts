import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
)

// Minimal, buyer-safe view of one order, for the post-payment "what happens
// next" panel.
//
// Shoppers can check out signed-out, so this can't be Clerk-gated — the order
// number (`ORD-<ms>-<5 random chars>`) is the bearer token. That's why the
// response is deliberately narrow: fulfillment type and status only. No
// buyer_email, no delivery_address, no payment_intent_id, no amounts — nothing
// that would reward guessing an order number.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params
  if (!orderNumber) return NextResponse.json({ error: 'orderNumber required' }, { status: 400 })

  const { data } = await supabase
    .from('orders')
    .select('order_number, status, fulfillment_type, member_id')
    .eq('order_number', orderNumber)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    order: {
      order_number: data.order_number,
      status: data.status,
      fulfillment_type: data.fulfillment_type,
      member_id: data.member_id,
    },
  })
}
