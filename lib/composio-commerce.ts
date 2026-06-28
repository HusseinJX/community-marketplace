import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { AuthScheme } from '@composio/core'
import { getComposio, authConfigIdFor, runTool, TOOL_SLUGS, type ComposioPlatform } from './composio'
import { getMember } from './api'
import type { Order } from './vendor-connect'

// Native Composio commerce layer for the marketplace.
//
// Ported from the connector-agent's composio-connect / composio-sync /
// composio-push-order functions — the app now owns OAuth connect, catalog sync,
// and order push-back directly against Supabase rather than proxying.
//
// Writes prefer the service-role key (bypasses RLS for catalog + connection
// state). Falls back to anon if that's all that's configured — in which case
// the `products` / `vendor_settings` grants must permit the write.
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

async function memberName(memberId: string): Promise<string> {
  try {
    const res = await getMember(memberId)
    return res?.member?.profile?.name || 'Vendor'
  } catch {
    return 'Vendor'
  }
}

// ── Connect (OAuth magic link) ──────────────────────────────────────────────

export interface ConnectResult {
  url: string
  connectionId: string
}

export interface ConnectOpts {
  // Shopify only: the vendor's store subdomain (the `x` in `x.myshopify.com`).
  // Required for Shopify because its OAuth authorize URL is store-specific.
  subdomain?: string
}

// Normalize whatever the vendor typed into a bare Shopify subdomain:
// "https://my-shop.myshopify.com/" / "my-shop.myshopify.com" / "my-shop" → "my-shop".
export function normalizeShopifySubdomain(input?: string): string {
  if (!input) return ''
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.myshopify\.com$/i, '')
    .trim()
}

// Start a Composio OAuth connection for a vendor's storefront. Initiates a
// connection scoped to userId=memberId, records platform + connection id on
// vendor_settings (so the UI shows "connected" and the order push-back path can
// gate on it), and returns the redirect the vendor opens to authorize.
export async function connectStore(
  memberId: string,
  platform: ComposioPlatform,
  opts: ConnectOpts = {}
): Promise<ConnectResult> {
  const authConfigId = authConfigIdFor(platform)
  const base = process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
  const callbackUrl = `${base}/vendor/integrations?connected=${platform}`

  // Shopify OAuth is per-store (authorize URL = {shop}.myshopify.com), so the
  // store subdomain must be supplied up front. Square is a central OAuth.
  let config: ReturnType<typeof AuthScheme.OAuth2> | undefined
  if (platform === 'shopify') {
    const subdomain = normalizeShopifySubdomain(opts.subdomain)
    if (!subdomain) throw new Error('Shopify store subdomain is required')
    config = AuthScheme.OAuth2({ subdomain })
  }

  const connRequest = await getComposio().connectedAccounts.initiate(memberId, authConfigId, {
    callbackUrl,
    ...(config ? { config } : {}),
  })
  if (!connRequest.redirectUrl) {
    throw new Error('Composio did not return an authorization URL')
  }

  // composio_connection_id doubles as the "is connected" flag the marketplace reads.
  const { error } = await db()
    .from('vendor_settings')
    .upsert(
      {
        member_id: memberId,
        composio_platform: platform,
        composio_connection_id: connRequest.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_id' }
    )
  if (error) throw new Error(`vendor_settings upsert failed: ${error.message}`)

  return { url: connRequest.redirectUrl as string, connectionId: connRequest.id }
}

// ── Catalog sync ────────────────────────────────────────────────────────────

interface ProductRow {
  member_id: string
  member_name: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  active: boolean
  source: string
  external_id: string
}

// Minimal provider payload shapes — only the fields we read. Confirm against the
// Composio tool return schemas in the dashboard before relying on more.
interface ShopifyVariant {
  price?: string | number
}
interface ShopifyImage {
  src?: string
}
interface ShopifyProduct {
  id?: string | number
  title?: string
  body_html?: string
  variants?: ShopifyVariant[]
  image?: ShopifyImage
  images?: ShopifyImage[]
}
interface SquareMoney {
  amount?: number
  currency?: string
}
interface SquareItemData {
  name?: string
  description?: string
  variations?: { item_variation_data?: { price_money?: SquareMoney } }[]
  image_ids?: string[]
}
interface SquareObject {
  id?: string | number
  type?: string
  item_data?: SquareItemData
  image_data?: { url?: string }
}

// Map a Shopify product (REST shape) → a marketplace `products` row. Shopify
// returns variants[]; we take the first variant's price and the first image.
// One row per product (not per variant).
function mapShopifyProduct(p: ShopifyProduct, memberId: string, name: string): ProductRow {
  const variant = Array.isArray(p.variants) ? p.variants[0] : null
  const image = p.image?.src || (Array.isArray(p.images) ? p.images[0]?.src : null) || null
  return {
    member_id: memberId,
    member_name: name,
    name: p.title || 'Untitled',
    description: p.body_html ? String(p.body_html).replace(/<[^>]+>/g, '').trim() : null,
    price: variant?.price != null ? Number(variant.price) : 0,
    currency: 'USD',
    image_url: image,
    active: true,
    source: 'shopify',
    external_id: String(p.id),
  }
}

// Map a Square catalog ITEM object → a marketplace `products` row. Square prices
// are integer cents in price_money.amount. Item images are separate IMAGE
// catalog objects referenced by item.image_ids; `imageMap` resolves the first.
function mapSquareItem(
  obj: SquareObject,
  memberId: string,
  name: string,
  imageMap: Record<string, string> = {}
): ProductRow {
  const item = obj.item_data || {}
  const variation = Array.isArray(item.variations) ? item.variations[0] : null
  const priceMoney = variation?.item_variation_data?.price_money
  const cents = priceMoney?.amount != null ? Number(priceMoney.amount) : 0
  const imageId = Array.isArray(item.image_ids) ? item.image_ids[0] : null
  return {
    member_id: memberId,
    member_name: name,
    name: item.name || 'Untitled',
    description: item.description || null,
    price: cents / 100,
    currency: priceMoney?.currency || 'USD',
    image_url: (imageId && imageMap[imageId]) || null,
    active: true,
    source: 'square',
    external_id: String(obj.id),
  }
}

export interface SyncResult {
  synced: number
  platform: ComposioPlatform | null
  skipped?: string
}

// Pull the live catalog for a connected vendor and upsert into Supabase.
// Reads vendor_settings.composio_platform to know which store, lists the catalog
// via Composio, maps to product rows, and upserts on (member_id, external_id).
export async function syncVendorCatalog(memberId: string): Promise<SyncResult> {
  const supabase = db()
  const { data: settings } = await supabase
    .from('vendor_settings')
    .select('composio_platform')
    .eq('member_id', memberId)
    .single()

  const platform = settings?.composio_platform as ComposioPlatform | undefined
  if (!platform || !TOOL_SLUGS[platform]) {
    return { synced: 0, platform: null, skipped: 'no connected platform for this member' }
  }

  const name = await memberName(memberId)

  let rows: ProductRow[] = []
  if (platform === 'shopify') {
    const data = await runTool(TOOL_SLUGS.shopify.list, memberId, {})
    const products = (data.products ||
      data.items ||
      (Array.isArray(data) ? data : [])) as ShopifyProduct[]
    rows = products.map((p) => mapShopifyProduct(p, memberId, name))
  } else if (platform === 'square') {
    // Pull ITEM + IMAGE together so we can resolve item.image_ids → URL in one call.
    const data = await runTool(TOOL_SLUGS.square.list, memberId, { types: 'ITEM,IMAGE' })
    const all = (data.objects || data.items || []) as SquareObject[]
    const imageMap: Record<string, string> = {}
    for (const o of all) {
      if (o.type === 'IMAGE' && o.image_data?.url) imageMap[String(o.id)] = o.image_data.url
    }
    const objects = all.filter((o) => o.type === 'ITEM')
    rows = objects.map((o) => mapSquareItem(o, memberId, name, imageMap))
  }

  if (rows.length) {
    const { error } = await supabase.from('products').upsert(rows, { onConflict: 'member_id,external_id' })
    if (error) throw new Error(`products upsert failed: ${error.message}`)
  }

  return { synced: rows.length, platform }
}

// List every member that has a connected store. Used by the daily cron.
export async function getConnectedMemberIds(): Promise<string[]> {
  const { data, error } = await db()
    .from('vendor_settings')
    .select('member_id, composio_platform')
    .not('composio_platform', 'is', null)
  if (error || !data) return []
  return (data as { member_id: string }[]).map((r) => r.member_id)
}

// ── Order push-back ─────────────────────────────────────────────────────────

// Push a completed marketplace order back into the vendor's store so their
// system of record reflects the sale (and inventory decrements there). Gated on
// the vendor having a connected platform. Fire-and-forget from the stripe
// webhook, so failures are logged, not surfaced to the buyer.
export async function pushOrderToStore(
  memberId: string,
  order: Pick<Order, 'order_number' | 'buyer_email' | 'items'>
): Promise<{ pushed: boolean; platform: ComposioPlatform | null }> {
  const { data: settings } = await db()
    .from('vendor_settings')
    .select('composio_platform')
    .eq('member_id', memberId)
    .single()

  const platform = settings?.composio_platform as ComposioPlatform | undefined
  if (!platform || !TOOL_SLUGS[platform]) {
    return { pushed: false, platform: null }
  }

  const items = Array.isArray(order.items) ? order.items : []

  if (platform === 'shopify') {
    const line_items = items.map((it) => ({
      title: it.name,
      quantity: it.qty,
      price: ((it.price_cents ?? 0) / 100).toFixed(2),
    }))
    await runTool(TOOL_SLUGS.shopify.createOrder, memberId, {
      line_items,
      email: order.buyer_email || undefined,
      financial_status: 'paid',
      note: `Marketplace order ${order.order_number}`,
      tags: 'community-marketplace',
    })
  } else if (platform === 'square') {
    // Square's order shape differs (line_items with base_price_money in cents).
    // Wired but unverified — confirm SQUARE_CREATE_ORDER arg schema in dashboard.
    const line_items = items.map((it) => ({
      name: it.name,
      quantity: String(it.qty),
      base_price_money: { amount: it.price_cents ?? 0, currency: 'USD' },
    }))
    await runTool(TOOL_SLUGS.square.createOrder, memberId, { order: { line_items } })
  }

  return { pushed: true, platform }
}
