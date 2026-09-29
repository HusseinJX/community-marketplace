import Link from 'next/link'
import { getConnectPayoutState } from '@/lib/connect-status'
import { ProductsManager } from '@/app/vendor/products/ProductsManager'
import { MembershipsManager } from '@/app/vendor/memberships/MembershipsManager'
import VendorOrders from '@/app/vendor/orders/page'

export type ShopView = 'products' | 'sales'
export type ProductKind = 'regular' | 'subscriptions'

// The shop, exploded onto the dashboard: the vendor lands on their catalogue.
//
// Two levels, both plain links rather than client state, so the existing
// screens drop in untouched (ProductsManager, MembershipsManager and the orders
// list are the same components their own pages render), the choice survives a
// reload, and Back undoes it:
//   ?view=products|sales            — the big switch
//   ?kind=regular|subscriptions     — the pills inside Products
// "Subscriptions" are the vendor's membership plans: the one thing they sell
// that repeats. The standalone pages (/vendor/products, /orders, /memberships)
// still exist for deep links.
export async function DashboardShop({
  view,
  kind,
  memberId,
  memberName,
  isAdmin,
  adminDemo,
  actingFor,
}: {
  view: ShopView
  kind: ProductKind
  memberId: string | null
  memberName: string
  isAdmin: boolean
  adminDemo: boolean
  // Admin "act on behalf" (?memberId=) has to ride along on every switch link,
  // or the first tap drops the admin back onto their own shop.
  actingFor?: string
}) {
  const href = (v: ShopView, k: ProductKind = 'regular') => {
    const q = new URLSearchParams()
    if (actingFor) q.set('memberId', actingFor)
    if (v !== 'products') q.set('view', v)
    if (v === 'products' && k !== 'regular') q.set('kind', k)
    const s = q.toString()
    return s ? `/vendor?${s}` : '/vendor'
  }

  const payouts =
    view === 'products' && kind === 'subscriptions' && memberId
      ? await getConnectPayoutState(memberId).catch(() => null)
      : null

  return (
    <section className="space-y-5">
      {/* The switch. Same shape as the app's other segmented toggles (the
          home tab row, the collab view switch): a stone pill track with the
          active half lifted to white — one control, exactly one side on. */}
      <div role="tablist" aria-label="Shop" className="inline-flex rounded-full bg-stone-100 p-1">
        {(
          [
            ['products', 'Products'],
            ['sales', 'Sales'],
          ] as const
        ).map(([v, label]) => (
          <Link
            key={v}
            href={href(v)}
            scroll={false}
            role="tab"
            aria-selected={view === v}
            className={
              'rounded-full px-5 py-1.5 text-sm font-semibold transition ' +
              (view === v
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800')
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {view === 'sales' ? (
        <VendorOrders />
      ) : (
        <div className="space-y-5">
          <div className="flex gap-2">
            {(
              [
                ['regular', 'Regular products'],
                ['subscriptions', 'Subscriptions'],
              ] as const
            ).map(([k, label]) => (
              <Link
                key={k}
                href={href('products', k)}
                scroll={false}
                aria-pressed={kind === k}
                className={
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition ' +
                  (kind === k
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300')
                }
              >
                {label}
              </Link>
            ))}
          </div>

          {kind === 'subscriptions' ? (
            <>
              {/* Same warning the memberships page gives: a membership is a sale
                  that repeats, so it needs the payout account first. */}
              {payouts && !payouts.active && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Connect your bank first</p>
                  <p className="mt-1 text-sm text-amber-800">
                    You can write your tiers now, but nobody can join until payouts are switched on.
                  </p>
                  <Link
                    href="/vendor/payments"
                    className="mt-3 inline-flex items-center justify-center rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Set up payouts
                  </Link>
                </div>
              )}
              <MembershipsManager />
            </>
          ) : memberId ? (
            <ProductsManager memberId={memberId} memberName={memberName} isAdmin={isAdmin} adminDemo={adminDemo} />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Link your member profile first</p>
              <p className="mt-1 text-sm text-amber-700">Connect your store profile to manage products.</p>
              <Link
                href="/vendor/setup"
                className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
