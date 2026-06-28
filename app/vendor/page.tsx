import { auth, currentUser } from '@clerk/nextjs/server'
import { Package, ShoppingCart, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getVendorProfile, getVendorConnectAccount, getOrdersByMember } from "@/lib/vendor-connect";
import { stripe } from "@/lib/stripe-server";
import { isDemoMode } from "@/lib/demo-admin";

export default async function VendorDashboard() {
  const { userId } = await auth()
  const demo = !userId && isDemoMode()
  const clerkUser = userId ? await currentUser() : null
  const user = clerkUser
    ? {
        id: clerkUser.id,
        firstName: clerkUser.firstName ?? null,
        email: clerkUser.emailAddresses?.[0]?.emailAddress ?? null,
      }
    : null

  const profile = user ? await getVendorProfile(user.id) : null;

  let stripeStatus: "none" | "pending" | "active" = "none";
  let orderCount = 0;
  if (profile) {
    const account = await getVendorConnectAccount(profile.member_id);
    if (account) {
      const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
      stripeStatus = stripeAccount.details_submitted && stripeAccount.charges_enabled ? "active" : "pending";
    }
    const orders = await getOrdersByMember(profile.member_id);
    orderCount = orders.length;
  }

  const cards = [
    { label: "Products", value: "3", href: "/vendor/products", icon: Package },
    { label: "Orders", value: orderCount > 0 ? String(orderCount) : "—", href: "/vendor/orders", icon: ShoppingCart },
    { label: "Events", value: "—", href: "/vendor/events", icon: Calendar },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        {user?.email && <p className="mt-1 text-sm text-stone-500">{user.email}</p>}
      </div>

      {/* Profile-link banner — shown until a member profile is claimed (not in demo) */}
      {!demo && !profile && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-900">Link your member profile</p>
          <p className="mt-1 text-sm text-amber-700">
            Connect your store profile to start managing products and receiving payments.
          </p>
          <Link
            href="/vendor/setup"
            className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
          >
            Get started
          </Link>
        </div>
      )}

      {/* Stripe-setup banner — shown when profile linked but Stripe not finished */}
      {!demo && profile && stripeStatus === "pending" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-900">Complete your Stripe setup</p>
          <p className="mt-1 text-sm text-amber-700">
            Finish connecting your bank account to receive payments from customers.
          </p>
          <a
            href={`/members/${profile.member_id}?stripe_connect=refresh`}
            className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
          >
            Continue setup
          </a>
        </div>
      )}

      {/* Quick access — compact metric grid */}
      <div>
        <p className="section-label mb-3">Quick access</p>
        <div className="grid grid-cols-3 gap-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="card-soft card-hover flex flex-col items-center gap-1 p-3 text-center"
              >
                <Icon className="h-5 w-5 text-indigo-500" />
                <span className="text-[11px] font-medium leading-tight text-stone-500">{card.label}</span>
                <span className="text-base font-semibold text-stone-900">{card.value}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Manage entry buttons */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/vendor/products"
          className="card-soft card-hover flex items-center justify-between p-5"
        >
          <span className="flex items-center gap-3">
            <Package className="h-5 w-5 text-indigo-500" />
            <span className="text-sm font-semibold text-stone-900">My Products</span>
          </span>
          <ArrowRight className="h-4 w-4 text-stone-400" />
        </Link>
        <Link
          href="/vendor/events"
          className="card-soft card-hover flex items-center justify-between p-5"
        >
          <span className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-indigo-500" />
            <span className="text-sm font-semibold text-stone-900">My Events</span>
          </span>
          <ArrowRight className="h-4 w-4 text-stone-400" />
        </Link>
      </div>
    </div>
  );
}
