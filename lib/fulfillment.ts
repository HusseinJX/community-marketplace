import { getVendorSettings, type VendorSettings } from '@/lib/vendor-connect'
import { uberConfigured } from '@/lib/uber-direct'

// Where a customer (or an Uber courier) physically collects an order.
//
// Resolution order: the vendor's explicit pickup address, else the business
// address on their connector profile — which is already public on /members/[id],
// so showing it to a buyer who has paid discloses nothing new.
//
// /api/uber/quote and /api/uber/dispatch each had their own inline copy of this
// lookup, which is how they drifted apart (quote required the connector profile
// and 400'd without it; dispatch preferred vendor_settings and silently
// continued with an empty string).
export async function pickupAddressFor(
  memberId: string,
  settings?: VendorSettings | null
): Promise<string> {
  const s = settings ?? (await getVendorSettings(memberId))
  if (s?.uber_pickup_address?.trim()) return s.uber_pickup_address.trim()

  const connectorUrl = process.env.CONNECTOR_URL ?? ''
  if (!connectorUrl) return ''
  try {
    const res = await fetch(`${connectorUrl}/.netlify/functions/marketplace-member?id=${memberId}`, {
      next: { revalidate: 300 },
    })
    const data = await res.json()
    const p = data?.member?.profile ?? {}
    return (p.businessAddress ?? p.address ?? '').trim()
  } catch {
    return ''
  }
}

export interface PickupContact {
  address: string
  phone: string
  name: string
}

/** Pickup address + contact, for dispatching a courier and for telling a buyer where to go. */
export async function pickupContactFor(memberId: string): Promise<PickupContact> {
  const settings = await getVendorSettings(memberId)
  const address = await pickupAddressFor(memberId, settings)
  let phone = settings?.uber_pickup_phone?.trim() ?? ''
  let name = ''

  if (!phone || !name) {
    const connectorUrl = process.env.CONNECTOR_URL ?? ''
    if (connectorUrl) {
      try {
        const res = await fetch(`${connectorUrl}/.netlify/functions/marketplace-member?id=${memberId}`, {
          next: { revalidate: 300 },
        })
        const data = await res.json()
        const p = data?.member?.profile ?? {}
        phone = phone || (p.businessPhone ?? p.phone ?? '')
        name = p.businessName ?? p.name ?? ''
      } catch {
        /* keep what we have */
      }
    }
  }

  return { address, phone, name }
}

/**
 * Can this vendor actually deliver right now? Both halves must hold: the vendor
 * opted in, AND the platform has Uber credentials. Checked server-side on every
 * path that offers or acts on delivery — the vendor's opt-out used to be
 * unenforced on the paid path, so a vendor who never touched delivery still had
 * their customers asked for a dropoff address.
 */
export async function deliveryAvailableFor(memberId: string): Promise<boolean> {
  if (!uberConfigured()) return false
  const settings = await getVendorSettings(memberId)
  return !!settings?.uber_direct_enabled
}

// ── Delivery mode ────────────────────────────────────────────────────────────

export type DeliveryMode = 'none' | 'self' | 'uber'

/**
 * The delivery mode this vendor can ACTUALLY offer right now.
 *
 * The stored mode is what they chose; this is what survives reality. `uber`
 * collapses to `none` without platform credentials — which is the state today,
 * since Uber is blocked on account activation. Self-delivery has no such
 * dependency: the vendor is the courier, so it works the moment they switch it
 * on. That asymmetry is the whole reason this feature exists.
 */
export function effectiveDeliveryMode(settings: VendorSettings | null): DeliveryMode {
  if (!settings) return 'none'
  // Fall back to the legacy boolean for rows written before delivery_mode
  // existed and never re-saved since.
  const stored: DeliveryMode = (settings.delivery_mode as DeliveryMode) ?? (settings.uber_direct_enabled ? 'uber' : 'none')
  if (stored === 'uber') return uberConfigured() ? 'uber' : 'none'
  if (stored === 'self') return 'self'
  return 'none'
}

export async function deliveryModeFor(memberId: string): Promise<DeliveryMode> {
  return effectiveDeliveryMode(await getVendorSettings(memberId))
}

/** The vendor's self-delivery rules, as a buyer is allowed to see them. */
export interface SelfDeliveryRules {
  feeCents: number
  freeOverCents: number | null
  minOrderCents: number | null
  /** Empty = delivers anywhere. */
  zips: string[]
  notes: string | null
}

export function selfDeliveryRules(settings: VendorSettings | null): SelfDeliveryRules {
  return {
    feeCents: Math.max(0, settings?.self_delivery_fee_cents ?? 0),
    freeOverCents: settings?.self_delivery_free_over_cents ?? null,
    minOrderCents: settings?.self_delivery_min_order_cents ?? null,
    zips: (settings?.self_delivery_zips ?? []).map(normalizeZip).filter(Boolean),
    notes: settings?.self_delivery_notes ?? null,
  }
}

// Compare postal codes on digits/letters only, uppercased, and for US ZIP+4
// take the first five — "94110-1234" and "94110" are the same round.
export function normalizeZip(zip: string | null | undefined): string {
  const cleaned = (zip ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^\d{9}$/.test(cleaned) ? cleaned.slice(0, 5) : cleaned
}

export type SelfDeliveryQuote =
  | { ok: true; feeCents: number; free: boolean }
  | { ok: false; reason: 'below_minimum' | 'out_of_area'; message: string; shortfallCents?: number }

/**
 * Price a self-delivery from the vendor's own rules. Pure, free, instant — no
 * external call, which is exactly why coverage is postal codes rather than a
 * geocoded radius.
 *
 * This is the ONLY place the fee is computed. The browser is shown the result
 * and the PaymentIntent recomputes it from scratch; a client-supplied fee is
 * never trusted, the same rule that stopped the shop's price-tampering bug.
 */
export function quoteSelfDelivery(
  rules: SelfDeliveryRules,
  subtotalCents: number,
  dropoffZip: string | null | undefined
): SelfDeliveryQuote {
  if (rules.minOrderCents != null && subtotalCents < rules.minOrderCents) {
    const shortfall = rules.minOrderCents - subtotalCents
    return {
      ok: false,
      reason: 'below_minimum',
      shortfallCents: shortfall,
      message: `Delivery starts at $${(rules.minOrderCents / 100).toFixed(2)} — add $${(shortfall / 100).toFixed(2)} more, or choose pickup.`,
    }
  }

  // An empty list means anywhere. Never read it as "nowhere": that would make
  // switching delivery on do nothing until the vendor typed out their city.
  if (rules.zips.length > 0) {
    const zip = normalizeZip(dropoffZip)
    if (!zip || !rules.zips.includes(zip)) {
      return {
        ok: false,
        reason: 'out_of_area',
        message: "This address is outside the area they deliver to — you can still pick up.",
      }
    }
  }

  const free = rules.freeOverCents != null && subtotalCents >= rules.freeOverCents
  return { ok: true, feeCents: free ? 0 : rules.feeCents, free }
}
