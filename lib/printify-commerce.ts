import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  getPrintifyCreds,
  listProducts,
  shippingCost,
  createOrder as printifyCreateOrder,
  type PrintifyAddress,
  type PrintifyLine,
} from './printify'
import type { DeliveryAddressJson, Order } from './vendor-connect'

// Printify ↔ marketplace: importing a catalog, quoting postage, pushing a paid
// order for production.

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

// ── Import ───────────────────────────────────────────────────────────────────

/**
 * Pull a vendor's Printify catalog into `products`.
 *
 * ONE MARKETPLACE ROW PER VARIANT, not per product. Printify prices and ships a
 * variant (a size, a colour), so a row that named only the product would have
 * no price to charge and nothing specific to send for printing. The cart, the
 * shipping quote and the production order then all address the same thing.
 *
 * Imported as DRAFTS (`active: false`). A catalog arriving from somewhere else
 * lands in the same approval queue as an AI-scanned menu — the vendor decides
 * what actually goes on sale here.
 */
export async function syncPrintifyCatalog(
  memberId: string,
  memberName: string
): Promise<{ imported: number; updated: number; skipped: number }> {
  const creds = await getPrintifyCreds(memberId)
  if (!creds?.shopId) return { imported: 0, updated: 0, skipped: 0 }

  const products = await listProducts(creds.token, creds.shopId)
  let imported = 0
  let updated = 0
  let skipped = 0

  for (const p of products) {
    for (const v of p.variants) {
      // A disabled variant is one Printify will refuse to print.
      if (!v.enabled || v.priceCents <= 0) {
        skipped++
        continue
      }

      // Multi-variant products get the variant in the name, single-variant ones
      // don't — "Tote bag / Default" reads like a bug on a storefront.
      const name = p.variants.length > 1 && v.title ? `${p.title} — ${v.title}` : p.title

      const { data: existing } = await db()
        .from('products')
        .select('id')
        .eq('member_id', memberId)
        .eq('printify_variant_id', v.variantId)
        .maybeSingle()

      const row = {
        member_id: memberId,
        member_name: memberName,
        name,
        description: p.description,
        price: v.priceCents,
        currency: 'usd',
        image_url: p.imageUrl,
        source: 'printify',
        kind: 'good',
        printify_product_id: p.productId,
        printify_variant_id: v.variantId,
        printify_shop_id: creds.shopId,
      }

      if (existing) {
        // Price and imagery follow Printify; `active` deliberately does NOT —
        // a re-sync must never un-hide something the vendor took down.
        await db().from('products').update(row).eq('id', existing.id)
        updated++
      } else {
        await db().from('products').insert({ ...row, active: false })
        imported++
      }
    }
  }

  return { imported, updated, skipped }
}

// ── Address ──────────────────────────────────────────────────────────────────

/** Our delivery address → Printify's shape. */
export function toPrintifyAddress(addr: DeliveryAddressJson, email: string | null): PrintifyAddress {
  const [first, ...rest] = (addr.name || '').trim().split(/\s+/)
  return {
    first_name: first || 'Customer',
    // Printify rejects an empty last name; repeating the first is better than
    // failing an order the buyer already paid for.
    last_name: rest.join(' ') || first || 'Customer',
    email: email || '',
    phone: addr.phone || '',
    // US-only for now: the marketplace is one city, and guessing a country from
    // a free-text state would produce orders shipped to the wrong hemisphere.
    country: 'US',
    region: addr.state || '',
    address1: addr.street || '',
    city: addr.city || '',
    zip: addr.zip || '',
  }
}

// ── Lines ────────────────────────────────────────────────────────────────────

export interface PricedLine {
  name: string
  quantity: number
}

/**
 * Resolve marketplace basket lines to Printify line items.
 *
 * Returns null when nothing in the basket is a Printify product, which is how
 * every caller tells "this is a POD order" from "this is an ordinary one".
 */
export async function printifyLinesFor(
  memberId: string,
  lines: PricedLine[]
): Promise<{ shopId: string; token: string; lines: PrintifyLine[] } | null> {
  const creds = await getPrintifyCreds(memberId)
  if (!creds?.shopId) return null

  const { data } = await db()
    .from('products')
    .select('name, printify_product_id, printify_variant_id')
    .eq('member_id', memberId)
    .not('printify_variant_id', 'is', null)
  const pod = (data ?? []) as { name: string; printify_product_id: string; printify_variant_id: string }[]

  const out: PrintifyLine[] = []
  for (const line of lines) {
    const match = pod.find((p) => p.name === line.name)
    if (!match) continue
    out.push({
      product_id: match.printify_product_id,
      // Printify variant ids are integers in its API even though we store them
      // as text.
      variant_id: Number(match.printify_variant_id),
      quantity: Math.max(1, Math.floor(line.quantity || 1)),
    })
  }

  if (out.length === 0) return null
  return { shopId: creds.shopId, token: creds.token, lines: out }
}

/** Postage for a basket, straight from Printify. Cents. */
export async function quotePrintifyShipping(
  memberId: string,
  lines: PricedLine[],
  address: DeliveryAddressJson,
  email: string | null
): Promise<number | null> {
  const resolved = await printifyLinesFor(memberId, lines)
  if (!resolved) return null
  return shippingCost(resolved.token, resolved.shopId, resolved.lines, toPrintifyAddress(address, email))
}

// ── Fulfilment ───────────────────────────────────────────────────────────────

/**
 * Send a paid order to Printify for production.
 *
 * Best-effort and idempotent: `external_id` is our order number, so a webhook
 * retry is refused by Printify as a duplicate rather than printing twice, and a
 * failure here is logged rather than thrown — the buyer has already paid, and
 * the vendor can push it by hand from their dashboard.
 */
export async function pushOrderToPrintify(order: Order): Promise<string | null> {
  try {
    if (order.printify_order_id) return order.printify_order_id
    if (!order.delivery_address) {
      console.error(`printify: order ${order.order_number} has no address`)
      return null
    }

    const resolved = await printifyLinesFor(
      order.member_id,
      (order.items ?? []).map((i) => ({ name: i.name, quantity: i.qty }))
    )
    if (!resolved) return null

    const { printifyOrderId } = await printifyCreateOrder(resolved.token, resolved.shopId, {
      externalId: order.order_number,
      label: order.order_number,
      lines: resolved.lines,
      address: toPrintifyAddress(order.delivery_address, order.buyer_email),
    })

    await db()
      .from('orders')
      .update({ printify_order_id: printifyOrderId, status: 'dispatched', updated_at: new Date().toISOString() })
      .eq('id', order.id)

    return printifyOrderId
  } catch (e) {
    console.error('printify order push failed:', e)
    return null
  }
}
