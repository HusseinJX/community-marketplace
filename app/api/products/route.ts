import { NextResponse } from 'next/server'
import { getAllActiveProducts } from '@/lib/vendor-connect'
import { groupVariants, type VariantRow } from '@/lib/product-variants'

export const runtime = 'nodejs'

// The whole storefront in one request, cached for a minute.
//
// GET takes no request data, so the segment is cacheable — the same reason
// /api/events/feed can be. A catalogue changes when a vendor edits it, a few
// times a day at most, and every home visit reads it.
export const revalidate = 60

/** What a card and a product page need. Kept to that — no description here;
 *  the full row is read on the product page itself, where it is shown. */
export interface ShopVariant {
  id: string
  /** "Black / L" — empty for a product with no variants. */
  label: string
  price: number
  image: string | null
  /** This variant's own mockups, cover first — the picker swaps the gallery. */
  images: string[]
}

export interface ShopProduct {
  /** The cheapest variant's id — what a card links to. */
  id: string
  /** The listing's name, without the variant suffix. */
  name: string
  /** The cheapest variant's price; `toPrice` differs when sizes cost more. */
  price: number
  toPrice: number
  currency: string
  image: string | null
  memberId: string
  memberName: string
  kind: string
  createdAt: string
  /** One entry per buyable variant. Length 1 for a plain product. */
  variants: ShopVariant[]
}

export async function GET() {
  try {
    const rows = await getAllActiveProducts()
    // No hidden-member filter here, deliberately — see the note in
    // lib/hidden-members.ts. That list keeps a BUSINESS out of the directory;
    // it is not a rule about the things they sell.
    //
    // Grouped into LISTINGS: the importer writes one row per Printify variant,
    // so an ungrouped grid shows nine identical shirts differing only in a size
    // printed after an em dash. See lib/product-variants.
    type Row = VariantRow & { raw: (typeof rows)[number] }
    const flat: Row[] = rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image_url ?? null,
      images: p.image_urls ?? (p.image_url ? [p.image_url] : []),
      printifyProductId:
        (p as unknown as { printify_product_id?: string | null }).printify_product_id ?? null,
      raw: p,
    }))

    const products: ShopProduct[] = groupVariants(flat).map((g) => ({
      id: g.lead.id,
      name: g.name,
      price: g.fromPrice,
      toPrice: g.toPrice,
      currency: g.lead.raw.currency || 'usd',
      image: g.lead.image,
      memberId: g.lead.raw.member_id,
      memberName: g.lead.raw.member_name,
      kind: g.lead.raw.kind || 'good',
      createdAt: (g.lead.raw as unknown as { created_at?: string }).created_at ?? '',
      variants: g.variants.map((v) => ({
        id: v.id,
        label: v.name.slice(g.name.length).replace(/^ — /, ''),
        price: v.price,
        image: v.image,
        images: v.images ?? (v.image ? [v.image] : []),
      })),
    }))
    return NextResponse.json({ products })
  } catch {
    // Empty rather than a 500: the tab renders its own empty state, and a
    // storefront that fails closed is better than one that fails loudly.
    return NextResponse.json({ products: [] })
  }
}
