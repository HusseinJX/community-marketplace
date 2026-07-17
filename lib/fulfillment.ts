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
