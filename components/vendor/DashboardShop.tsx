import Link from 'next/link'
import { getConnectPayoutState } from '@/lib/connect-status'
import { ProductsManager } from '@/app/vendor/products/ProductsManager'
import { MembershipsManager } from '@/app/vendor/memberships/MembershipsManager'
import { OrdersList } from '@/app/vendor/orders/OrdersList'
import { EventsManager } from '@/app/vendor/events/EventsManager'
import { MessagesShell } from '@/app/vendor/messages/MessagesShell'
import { CustomerInbox } from '@/app/vendor/messages/CustomerInbox'
import { getMember } from '@/lib/api'

export type ShopView = 'products' | 'sales' | 'events' | 'messages'
export type ProductKind = 'regular' | 'subscriptions'
export type SalesTab = 'orders' | 'memberships'

// The dashboard's working area: the vendor lands on their catalogue, and
// Sales, Events and Messages open in the same place rather than as new pages.
//
// Two levels, both plain links rather than client state, so the existing
// screens drop in untouched (ProductsManager, MembershipsManager, the orders
// list, EventsManager and MessagesShell are the same components their own
// pages render), the choice survives a reload, and Back undoes it:
//   ?view=products|sales|events|messages   — four separate pills
//   ?kind=regular|subscriptions     — Products | Subscriptions, inside Products
//   ?tab=orders|memberships         — Sales | Memberships, inside Sales
// Subscriptions is the plan EDITOR (what you sell); Memberships under Sales is
// who bought one and what it adds up to (what sold).
// "Subscriptions" are the vendor's membership plans: the one thing they sell
// that repeats. The standalone pages (/vendor/products, /orders, /memberships)
// still exist for deep links.
export async function DashboardShop({
  view,
  kind,
  salesTab,
  memberId,
  memberName,
  isAdmin,
  adminDemo,
  actingFor,
  plan,
}: {
  view: ShopView
  kind: ProductKind
  salesTab: SalesTab
  memberId: string | null
  memberName: string
  isAdmin: boolean
  adminDemo: boolean
  // Admin "act on behalf" (?memberId=) has to ride along on every switch link,
  // or the first tap drops the admin back onto their own shop.
  actingFor?: string
  // Messages gates collaboration INITIATING on the plan (CollabsGate).
  plan: string
}) {
  const href = (v: ShopView, k: ProductKind = 'regular', t: SalesTab = 'orders') => {
    const q = new URLSearchParams()
    if (actingFor) q.set('memberId', actingFor)
    if (v !== 'products') q.set('view', v)
    if (v === 'products' && k !== 'regular') q.set('kind', k)
    if (v === 'sales' && t !== 'orders') q.set('tab', t)
    const s = q.toString()
    return s ? `/vendor?${s}` : '/vendor'
  }

  // Events places new events relative to the business, so it wants the
  // coordinates — only fetched when that view is actually open.
  let businessLat: number | null = null
  let businessLng: number | null = null
  if (view === 'events' && memberId) {
    try {
      const m = await getMember(memberId)
      const p = m.member.profile
      businessLat = typeof p?.latitude === 'number' ? p.latitude : null
      businessLng = typeof p?.longitude === 'number' ? p.longitude : null
    } catch {
      /* no coordinates → EventsManager falls back as on its own page */
    }
  }

  const payouts =
    view === 'products' && kind === 'subscriptions' && memberId
      ? await getConnectPayoutState(memberId).catch(() => null)
      : null

  return (
    <section className="space-y-5">
      {/* Four sections, four separate pills — not a segmented track. Hidden
          while a Messages conversation is open (data-vendor-nav), so the chat
          gets the height it is sized to. */}
      <nav data-vendor-nav aria-label="Dashboard" className="flex flex-wrap gap-2">
        {(
          [
            ['products', 'Products'],
            ['sales', 'Sales'],
            ['events', 'Events'],
            ['messages', 'Messages'],
          ] as const
        ).map(([v, label]) => (
          <Link
            key={v}
            href={href(v)}
            scroll={false}
            aria-current={view === v ? 'page' : undefined}
            className={
              'rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ' +
              (view === v
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300')
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      {view === 'sales' ? (
        <div className="space-y-5">
          <Segmented
            label="Sales"
            options={[
              { key: 'orders', label: 'Sales', href: href('sales', 'regular', 'orders') },
              { key: 'memberships', label: 'Memberships', href: href('sales', 'regular', 'memberships') },
            ]}
            active={salesTab}
          />
          {salesTab === 'memberships' ? <MembershipsManager show="members" /> : <OrdersList title="Sales" />}
        </div>
      ) : view === 'events' ? (
        memberId ? (
          <EventsManager
            memberId={memberId}
            memberName={memberName}
            isAdmin={isAdmin}
            adminDemo={adminDemo}
            businessLat={businessLat}
            businessLng={businessLng}
          />
        ) : (
          <LinkFirst what="manage events" />
        )
      ) : view === 'messages' ? (
        // No linked profile → no collaborations, but customer messages don't
        // need one (same rule as /vendor/messages).
        memberId ? (
          <MessagesShell memberId={memberId} isAdmin={isAdmin} plan={plan} adminDemo={adminDemo} />
        ) : (
          <CustomerInbox />
        )
      ) : (
        <div className="space-y-5">
          {/* Products | Subscriptions — one segmented control (a stone track,
              the active half lifted to white), so it reads as a switch INSIDE
              Products rather than two more section pills. */}
          <Segmented
            label="Products"
            options={[
              { key: 'regular', label: 'Products', href: href('products', 'regular') },
              { key: 'subscriptions', label: 'Subscriptions', href: href('products', 'subscriptions') },
            ]}
            active={kind}
          />

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
              <MembershipsManager show="plans" />
            </>
          ) : memberId ? (
            <ProductsManager memberId={memberId} memberName={memberName} isAdmin={isAdmin} adminDemo={adminDemo} />
          ) : (
            <LinkFirst what="manage products" />
          )}
        </div>
      )}
    </section>
  )
}

function LinkFirst({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Link your member profile first</p>
      <p className="mt-1 text-sm text-amber-700">Connect your store profile to {what}.</p>
      <Link
        href="/vendor/setup"
        className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
      >
        Get started
      </Link>
    </div>
  )
}

// The second-level switch (Products | Subscriptions, Sales | Memberships):
// a stone track with the active half lifted to white.
function Segmented({
  label,
  options,
  active,
}: {
  label: string
  options: { key: string; label: string; href: string }[]
  active: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full bg-stone-100 p-1">
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          scroll={false}
          role="tab"
          aria-selected={active === o.key}
          className={
            'rounded-full px-4 py-1.5 text-[13px] font-semibold transition ' +
            (active === o.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')
          }
        >
          {o.label}
        </Link>
      ))}
    </div>
  )
}
