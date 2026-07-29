import type { Plan } from '@/lib/entitlements'

// The App Store subscription products, and how they map to platform plans. This
// is the ONE place the product ids live — the native StoreKit plugin fetches
// these ids, and the server maps a purchased product back to a plan. Keep in
// sync with the auto-renewable subscriptions created in App Store Connect
// (bundle ai.whatslocal.app). Prices are set in App Store Connect, not here.
//
// Only the two self-serve plans are sold via IAP (free needs no purchase;
// enterprise is contact-sales). Member ≈ $9.99/mo, Pro ≈ $29.99/mo.
export const IAP_PRODUCTS: Record<'member' | 'pro', string> = {
  member: 'ai.whatslocal.member.monthly',
  pro: 'ai.whatslocal.pro.monthly',
}

// All product ids the app should query from StoreKit.
export const IAP_PRODUCT_IDS: string[] = Object.values(IAP_PRODUCTS)

const PLAN_BY_PRODUCT: Record<string, Plan> = Object.fromEntries(
  Object.entries(IAP_PRODUCTS).map(([plan, id]) => [id, plan as Plan]),
)

/** Map an Apple product id back to the platform plan it grants ('free' if unknown). */
export function planFromProductId(productId: string | null | undefined): Plan {
  return (productId && PLAN_BY_PRODUCT[productId]) || 'free'
}

/** The Apple product id for a purchasable plan (null for free/enterprise). */
export function productIdForPlan(plan: Plan): string | null {
  return plan === 'member' || plan === 'pro' ? IAP_PRODUCTS[plan] : null
}
