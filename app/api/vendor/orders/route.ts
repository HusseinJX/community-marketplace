import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile, getOrdersByMember, updateOrderStatus } from '@/lib/vendor-connect'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const orders = await getOrdersByMember(profile.member_id)
  return NextResponse.json({ orders })
}

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const body = await request.json()
  const { orderId, status }: { orderId: string; status: string } = body

  const allowed = ['paid', 'ready', 'dispatched', 'delivered', 'refunded']
  if (!orderId || !allowed.includes(status)) {
    return NextResponse.json({ error: 'orderId and valid status required' }, { status: 400 })
  }

  await updateOrderStatus(orderId, status)
  return NextResponse.json({ success: true })
}
