import { NextResponse } from 'next/server'
import { getProductsByMember } from '@/lib/vendor-connect'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params
  const products = await getProductsByMember(memberId)
  return NextResponse.json(products)
}
