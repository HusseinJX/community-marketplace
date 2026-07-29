// Native In-App Purchase bridge (iOS StoreKit).
//
// Apple 3.1.1 requires digital subscriptions to be sold through StoreKit inside
// the app — not Stripe/web checkout. The native shell (whatslocal-ios) provides
// a `Iap` Capacitor plugin (StoreKit 2) exposed to the hosted web as
// `Capacitor.Plugins.Iap`. This module fetches products, runs a purchase, and
// hands the resulting Apple-signed transaction to our server (/api/iap/verify),
// which is the ONLY thing that grants a plan — the client never asserts a plan.
//
// Until the plugin is installed + the app rebuilt it's absent; callers should
// gate on `isNativeApp()` and surface the thrown message.

import { IAP_PRODUCTS } from '@/lib/iap-products'

type IapPlugin = {
  getProducts: (o: { productIds: string[] }) => Promise<{ products: NativeProduct[] }>
  purchase: (o: { productId: string }) => Promise<NativePurchase>
  restore: () => Promise<{ entitlements: NativePurchase[] }>
}

interface NativeProduct {
  id: string
  displayPrice: string // localized, e.g. "$9.99"
  displayName?: string
  description?: string
}

interface NativePurchase {
  productId: string
  jws: string // signed transaction (StoreKit 2 Transaction.jwsRepresentation)
  transactionId?: string
}

export interface IapProduct {
  plan: 'member' | 'pro'
  productId: string
  displayPrice: string
}

function plugin(): IapPlugin | undefined {
  if (typeof window === 'undefined') return undefined
  const c = (window as unknown as {
    Capacitor?: { registerPlugin?: (n: string) => unknown; Plugins?: Record<string, unknown> }
  }).Capacitor
  if (!c) return undefined
  if (typeof c.registerPlugin === 'function') {
    try {
      return c.registerPlugin('Iap') as IapPlugin
    } catch {
      /* fall through */
    }
  }
  return c.Plugins?.Iap as IapPlugin | undefined
}

/** True when the StoreKit plugin is present (native build with IAP wired). */
export function nativeIapAvailable(): boolean {
  return !!plugin()?.purchase
}

const PLAN_BY_PRODUCT = Object.fromEntries(
  Object.entries(IAP_PRODUCTS).map(([plan, id]) => [id, plan as 'member' | 'pro']),
)

/** Fetch localized prices for the purchasable plans from StoreKit. */
export async function nativeGetProducts(): Promise<IapProduct[]> {
  const p = plugin()
  if (!p?.getProducts) throw new Error('In-app purchases aren’t available in this app build yet.')
  const { products } = await p.getProducts({ productIds: Object.values(IAP_PRODUCTS) })
  return products
    .map((prod) => {
      const plan = PLAN_BY_PRODUCT[prod.id]
      return plan ? { plan, productId: prod.id, displayPrice: prod.displayPrice } : null
    })
    .filter((x): x is IapProduct => x !== null)
}

async function verifyOnServer(jws: string, memberId: string | null): Promise<'free' | 'member' | 'pro' | 'enterprise'> {
  const res = await fetch('/api/iap/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jws, memberId }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d?.error === 'no_member' ? 'Link your business profile first.' : 'Purchase couldn’t be verified.')
  return d.plan
}

/**
 * Buy a plan via StoreKit and grant it server-side. Returns the granted plan.
 * Throws 'canceled' if the user dismisses the Apple sheet (callers can ignore).
 */
export async function nativePurchase(
  plan: 'member' | 'pro',
  memberId: string | null,
): Promise<'free' | 'member' | 'pro' | 'enterprise'> {
  const p = plugin()
  if (!p?.purchase) throw new Error('In-app purchases aren’t available in this app build yet.')
  const productId = IAP_PRODUCTS[plan]
  const result = await p.purchase({ productId }) // rejects 'canceled' on dismissal
  return verifyOnServer(result.jws, memberId)
}

/**
 * Restore Purchases (Apple requires this control). Re-verifies every active
 * StoreKit entitlement server-side so the member's plan is re-granted on a new
 * device / reinstall. Returns the highest plan restored ('free' if none).
 */
export async function nativeRestore(memberId: string | null): Promise<'free' | 'member' | 'pro' | 'enterprise'> {
  const p = plugin()
  if (!p?.restore) throw new Error('In-app purchases aren’t available in this app build yet.')
  const { entitlements } = await p.restore()
  let best: 'free' | 'member' | 'pro' | 'enterprise' = 'free'
  const rank = { free: 0, member: 1, pro: 2, enterprise: 3 }
  for (const e of entitlements) {
    const plan = await verifyOnServer(e.jws, memberId).catch(() => 'free' as const)
    if (rank[plan] > rank[best]) best = plan
  }
  return best
}
