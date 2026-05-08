import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { getVendorProfile, getVendorConnectAccount } from "@/lib/vendor-connect";
import { stripe } from "@/lib/stripe-server";

export default async function VendorDashboard() {
  const { user } = await withAuth();

  const profile = user ? await getVendorProfile(user.id) : null;

  let stripeStatus: 'none' | 'pending' | 'active' = 'none'
  if (profile) {
    const account = await getVendorConnectAccount(profile.member_id)
    if (account) {
      const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)
      stripeStatus = stripeAccount.details_submitted && stripeAccount.charges_enabled
        ? 'active'
        : 'pending'
    }
  }

  const cards = [
    { label: "Products", icon: "📦", value: "—", href: "/vendor/products" },
    { label: "Orders", icon: "🧾", value: "—", href: "/vendor/orders" },
    { label: "Payments", icon: "💳", value: "—", href: "/vendor/payments" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="text-2xl">{card.icon}</div>
            <p className="mt-3 text-sm font-medium text-stone-500">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold text-stone-900">{card.value}</p>
          </div>
        ))}
      </div>

      {!profile && (
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

      {profile && stripeStatus === 'pending' && (
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
    </div>
  );
}
