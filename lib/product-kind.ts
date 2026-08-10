// What kind of thing is being sold, and what that implies about fulfillment.
//
// One vocabulary, imported by the vendor catalog UI, the checkout, the orders
// dashboard and the payment routes — so nothing can decide on its own that a
// consultation gets a "Mark Ready" button.

export const PRODUCT_KINDS = ['good', 'service', 'digital', 'ticket'] as const
export type ProductKind = (typeof PRODUCT_KINDS)[number]

export interface KindDef {
  key: ProductKind
  label: string
  /** Shown to the vendor when they pick it. */
  blurb: string
  /** True when the buyer physically receives an object — the only case with pickup/delivery. */
  physical: boolean
}

export const KIND_DEFS: Record<ProductKind, KindDef> = {
  good: {
    key: 'good',
    label: 'Physical item',
    blurb: 'Something the customer collects or you deliver.',
    physical: true,
  },
  service: {
    key: 'service',
    label: 'Service',
    blurb: "Something you do for them. Nothing to hand over — you'll arrange it together.",
    physical: false,
  },
  digital: {
    key: 'digital',
    label: 'Digital download',
    blurb: 'A file they get by email the moment they pay.',
    physical: false,
  },
  ticket: {
    key: 'ticket',
    label: 'Event ticket',
    blurb: 'Sold on the event itself, not here.',
    physical: false,
  },
}

export function kindOf(value: string | null | undefined): ProductKind {
  // Anything unrecognised is a physical good: it's what every row was before
  // this column existed, and it's the only reading that can't silently skip a
  // handover the customer is expecting.
  return (PRODUCT_KINDS as readonly string[]).includes(value ?? '') ? (value as ProductKind) : 'good'
}

export function isPhysical(value: string | null | undefined): boolean {
  return KIND_DEFS[kindOf(value)].physical
}

/** How an order made of these items has to be fulfilled. */
export type BasketFulfillment = 'physical' | 'digital' | 'service'

/**
 * Decide what a basket needs, from what's in it.
 *
 * A MIXED basket counts as physical: if a single item has to change hands, the
 * order still needs a pickup or a delivery, and the digital half rides along
 * for free. Treating it as digital would strand the physical item with nobody
 * scheduled to hand it over — the failure that actually costs someone a
 * sandwich, versus a download that arrives either way.
 */
export function basketFulfillment(kinds: (string | null | undefined)[]): BasketFulfillment {
  if (kinds.length === 0) return 'physical'
  if (kinds.some(isPhysical)) return 'physical'
  if (kinds.some((k) => kindOf(k) === 'service')) return 'service'
  return 'digital'
}

/** The word for "this order is finished", which differs by what was sold. */
export function terminalStatusFor(fulfillmentType: string): string {
  if (fulfillmentType === 'digital') return 'delivered'
  if (fulfillmentType === 'service') return 'completed'
  if (fulfillmentType === 'delivery') return 'delivered'
  return 'collected'
}
