import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, deliveryAddress, quoteId, feeCents } = body

    if (!orderId || !deliveryAddress || !quoteId) {
      return NextResponse.json({ error: 'orderId, deliveryAddress, and quoteId required' }, { status: 400 })
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    const { error } = await supabase
      .from('orders')
      .update({
        delivery_requested: true,
        delivery_address: deliveryAddress,
        uber_quote_id: quoteId,
        delivery_fee_cents: feeCents ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save delivery'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
