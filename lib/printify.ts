import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Printify REST client. No SDK — it's a handful of JSON endpoints, and a
// dependency that wraps them would be more code than this file.
//
// ⚠️ UNVERIFIED AGAINST THE LIVE API. Everything else in the commerce stack was
// exercised against the real service before shipping; this could not be,
// because nobody has connected a Printify account yet. Response shapes are read
// defensively (optional chaining, tolerant field names) so a drifted field
// degrades to "no products" rather than a crash — but the first real connect is
// still the test. See `scripts/printify-smoke.mts`.

const API = 'https://api.printify.com/v1'

let client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    // Service-role is REQUIRED, not preferred: vendor_secrets denies anon by
    // design, so the anon fallback used elsewhere would simply read nothing.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Printify needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}

/** Printify needs no platform-level key — each vendor brings their own token. */
export function printifyConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

// ── Credentials ──────────────────────────────────────────────────────────────

export interface PrintifyCreds {
  token: string
  shopId: string | null
}

export async function getPrintifyCreds(memberId: string): Promise<PrintifyCreds | null> {
  const { data } = await db()
    .from('vendor_secrets')
    .select('printify_token, printify_shop_id')
    .eq('member_id', memberId)
    .maybeSingle()
  if (!data?.printify_token) return null
  return { token: data.printify_token, shopId: data.printify_shop_id ?? null }
}

export async function savePrintifyCreds(memberId: string, creds: { token?: string; shopId?: string | null }): Promise<void> {
  const row: Record<string, unknown> = { member_id: memberId, updated_at: new Date().toISOString() }
  if (creds.token !== undefined) row.printify_token = creds.token
  if (creds.shopId !== undefined) row.printify_shop_id = creds.shopId
  const { error } = await db().from('vendor_secrets').upsert(row, { onConflict: 'member_id' })
  if (error) throw new Error(`Failed to save Printify credentials: ${error.message}`)
}

export async function disconnectPrintify(memberId: string): Promise<void> {
  await db()
    .from('vendor_secrets')
    .update({ printify_token: null, printify_shop_id: null, updated_at: new Date().toISOString() })
    .eq('member_id', memberId)
}

// ── Transport ────────────────────────────────────────────────────────────────

export class PrintifyError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function call<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Printify asks integrations to identify themselves.
      'User-Agent': 'WhatsLocal-AI-Marketplace',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // These run inside a request handler; a hung upstream must not hold a
    // checkout open indefinitely.
    signal: AbortSignal.timeout(20_000),
  })

  const text = await res.text()
  if (!res.ok) {
    // Printify returns {message} or {errors:{...}}; surface whichever exists,
    // but never the raw body to a buyer — callers decide what to show.
    let detail = text.slice(0, 300)
    try {
      const parsed = JSON.parse(text)
      detail = parsed?.message ?? parsed?.error ?? detail
    } catch {
      /* keep the raw slice */
    }
    throw new PrintifyError(`Printify ${res.status}: ${detail}`, res.status)
  }
  return (text ? JSON.parse(text) : {}) as T
}

// ── Shops ────────────────────────────────────────────────────────────────────

export interface PrintifyShop {
  id: string
  title: string
  channel: string | null
}

/** List the shops a token can see. Doubles as the token's validity check. */
export async function listShops(token: string): Promise<PrintifyShop[]> {
  const raw = await call<unknown>(token, '/shops.json')
  const arr = Array.isArray(raw) ? raw : []
  return arr.map((s) => {
    const shop = s as Record<string, unknown>
    return {
      id: String(shop.id ?? ''),
      title: String(shop.title ?? 'Shop'),
      channel: (shop.sales_channel as string) ?? null,
    }
  })
}

// ── Products ─────────────────────────────────────────────────────────────────

export interface PrintifyVariant {
  variantId: string
  title: string
  /** Printify prices in CENTS, same unit as `products.price`. */
  priceCents: number
  enabled: boolean
}

export interface PrintifyProduct {
  productId: string
  title: string
  description: string | null
  imageUrl: string | null
  variants: PrintifyVariant[]
}

function stripHtml(s: string): string {
  // Printify descriptions are HTML. The marketplace renders plain text, and
  // injecting a vendor's HTML into our pages would be an XSS surface.
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function listProducts(token: string, shopId: string, limit = 50): Promise<PrintifyProduct[]> {
  const raw = await call<{ data?: unknown[] }>(token, `/shops/${shopId}/products.json?limit=${limit}`)
  const rows = Array.isArray(raw?.data) ? raw.data : []

  return rows.map((r) => {
    const p = r as Record<string, unknown>
    const images = Array.isArray(p.images) ? (p.images as Record<string, unknown>[]) : []
    const cover = images.find((i) => i.is_default) ?? images[0]
    const variants = Array.isArray(p.variants) ? (p.variants as Record<string, unknown>[]) : []

    return {
      productId: String(p.id ?? ''),
      title: String(p.title ?? 'Untitled'),
      description: p.description ? stripHtml(String(p.description)).slice(0, 500) : null,
      imageUrl: cover?.src ? String(cover.src) : null,
      variants: variants.map((v) => ({
        variantId: String(v.id ?? ''),
        title: String(v.title ?? ''),
        priceCents: Math.max(0, Math.round(Number(v.price) || 0)),
        // Printify keeps disabled variants on the product; selling one would be
        // an order Printify refuses to print.
        enabled: v.is_enabled !== false,
      })),
    }
  })
}

// ── Shipping ─────────────────────────────────────────────────────────────────

export interface PrintifyAddress {
  first_name: string
  last_name: string
  email: string
  phone: string
  country: string
  region: string
  address1: string
  address2?: string
  city: string
  zip: string
}

export interface PrintifyLine {
  product_id: string
  variant_id: number
  quantity: number
}

/**
 * What Printify will charge to ship this basket to this address.
 *
 * Quoted BEFORE payment, for the same reason the courier fee is: a shipping
 * cost discovered afterwards is a cost the vendor silently eats. Returns the
 * standard rate in cents.
 */
export async function shippingCost(
  token: string,
  shopId: string,
  lines: PrintifyLine[],
  address: PrintifyAddress
): Promise<number> {
  const raw = await call<Record<string, unknown>>(token, `/shops/${shopId}/orders/shipping.json`, {
    method: 'POST',
    body: { line_items: lines, address_to: address },
  })
  const standard = Number(raw?.standard)
  if (!Number.isFinite(standard)) throw new PrintifyError('Printify returned no shipping rate', 502)
  return Math.max(0, Math.round(standard))
}

// ── Orders ───────────────────────────────────────────────────────────────────

/**
 * Submit a paid order for production.
 *
 * `external_id` is our order number, which makes this idempotent from
 * Printify's side: a webhook retry re-submitting the same order is rejected as
 * a duplicate rather than printing a second shirt.
 */
export async function createOrder(
  token: string,
  shopId: string,
  order: {
    externalId: string
    label: string
    lines: PrintifyLine[]
    address: PrintifyAddress
  }
): Promise<{ printifyOrderId: string }> {
  const raw = await call<Record<string, unknown>>(token, `/shops/${shopId}/orders.json`, {
    method: 'POST',
    body: {
      external_id: order.externalId,
      label: order.label,
      line_items: order.lines,
      // 1 = standard. Express would need to be quoted and charged separately;
      // offering it without charging for it is the bug this whole area keeps
      // rediscovering.
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: order.address,
    },
  })
  return { printifyOrderId: String(raw?.id ?? '') }
}
