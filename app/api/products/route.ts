import { NextResponse } from 'next/server'
import { getAllActiveProducts } from '@/lib/vendor-connect'

export const runtime = 'nodejs'

// The whole storefront in one request, cached for a minute.
//
// GET takes no request data, so the segment is cacheable — the same reason
// /api/events/feed can be. A catalogue changes when a vendor edits it, a few
// times a day at most, and every home visit reads it.
export const revalidate = 60

/** What a card and a product page need. Kept to that — no description here;
 *  the full row is read on the product page itself, where it is shown. */
export interface ShopProduct {
  id: string
  name: string
  price: number
  currency: string
  image: string | null
  memberId: string
  memberName: string
  kind: string
  createdAt: string
}

export async function GET() {
  try {
    const rows = await getAllActiveProducts()
    // No hidden-member filter here, deliberately — see the note in
    // lib/hidden-members.ts. That list keeps a BUSINESS out of the directory;
    // it is not a rule about the things they sell.
    const products: ShopProduct[] = rows
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency || 'usd',
        image: p.image_url ?? null,
        memberId: p.member_id,
        memberName: p.member_name,
        kind: p.kind || 'good',
        createdAt: (p as unknown as { created_at?: string }).created_at ?? '',
      }))
    return NextResponse.json({ products })
  } catch {
    // Empty rather than a 500: the tab renders its own empty state, and a
    // storefront that fails closed is better than one that fails loudly.
    return NextResponse.json({ products: [] })
  }
}
