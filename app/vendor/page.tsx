import { auth, currentUser } from '@clerk/nextjs/server'
import Link from "next/link";
import { getVendorProfile, getVendorConnectAccount, getOrdersByMember, getVendorSettings } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { stripe } from "@/lib/stripe-server";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { getMember } from "@/lib/api";
import { getEntitlements, PLAN_META } from "@/lib/entitlements";
import { SITE_URL } from "@/lib/seo";
import { VendorHome } from "@/components/vendor/VendorHome";
import { SellChecklist, type SellStep } from "@/components/vendor/SellChecklist";
import { uberConfigured } from "@/lib/uber-direct";
import { TitleQrButton } from "@/components/vendor/TitleQrButton";
import { VendorSignOut } from "@/components/vendor/VendorSignOut";

export default async function VendorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { userId } = await auth()
  const { memberId: requested } = await searchParams
  const demo = !userId && (await isDemoActive())
  const clerkUser = userId ? await currentUser() : null
  const user = clerkUser
    ? {
        id: clerkUser.id,
        firstName: clerkUser.firstName ?? null,
        email: clerkUser.emailAddresses?.[0]?.emailAddress ?? null,
      }
    : null

  const profile = user ? await getVendorProfile(user.id) : null;
  const admin = isAdmin(userId);

  let stripeStatus: "none" | "pending" | "active" = "none";
  let orderCount = 0;
  let shopConnected = false;
  let deliveryOn = false;
  if (profile) {
    const account = await getVendorConnectAccount(profile.member_id);
    if (account) {
      try {
        const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
        stripeStatus = stripeAccount.details_submitted && stripeAccount.charges_enabled ? "active" : "pending";
      } catch {
        // Stripe unreachable — the row exists, so setup was started but we can't
        // prove it finished. Claiming "active" here would hide the finish link.
        stripeStatus = "pending";
      }
    }
    const orders = await getOrdersByMember(profile.member_id);
    orderCount = orders.length;
    const settings = await getVendorSettings(profile.member_id);
    shopConnected = !!settings?.composio_connection_id;
    deliveryOn = !!settings?.uber_direct_enabled;
  }

  // Tools that aren't in the slim top nav (Home/Live/Collabs/Resources/QR).
  // (Network lives under Collabs; Organize lives under My Events; Onboard hidden.)
  // Super-admin + Featured are intentionally NOT listed — the super-admin dash is
  // reachable only via its direct URL (/vendor/admin).
  // Admins can act on behalf of any member (?memberId=), same as the other
  // vendor pages — otherwise it's their own linked profile.
  const memberId =
    (admin && requested) || profile?.member_id || (demo ? await demoMemberId() : null);

  const entitlements = memberId ? await getEntitlements(memberId) : null;
  const plan = entitlements?.plan ?? (demo ? "pro" : "free");
  const planLabel = PLAN_META[plan].label;

  const profileUrl = memberId ? `${SITE_URL}/members/${memberId}` : null;

  // Selling is a Pro capability, so the checklist only makes sense to someone who
  // has it — a Free vendor gets the upgrade card in VendorHome instead of a list
  // of steps they can't take.
  const canSell = entitlements?.can.commerce || admin;
  const sellSteps: SellStep[] | null = canSell
    ? [
        {
          label: "Connect your shop",
          desc: "Sync your Shopify or Square catalog",
          href: "/vendor/integrations",
          done: shopConnected,
        },
        {
          label: "Set up payouts",
          desc: "Add the bank account your sales pay into",
          href: "/vendor/integrations",
          done: stripeStatus === "active",
        },
        // Only offered when the platform actually has Uber credentials —
        // otherwise it's a step the vendor can't complete. Pickup-only is a
        // legitimate way to run a shop, so it never blocks the others either.
        ...(uberConfigured()
          ? [
              {
                label: "Turn on delivery",
                desc: "Let customers get orders delivered by Uber",
                href: "/vendor/integrations",
                done: deliveryOn,
                optional: true,
              },
            ]
          : []),
      ]
    : null;

  // Business name — lives on the member record, not vendor_profiles. (The full
  // "about" details are edited on their own page at /vendor/about.)
  let businessName = user?.firstName || "your business";
  if (memberId) {
    try {
      const m = await getMember(memberId);
      const p = (m as {
        member?: { profile?: { businessName?: string; name?: string } };
      })?.member?.profile;
      businessName = p?.businessName || p?.name || businessName;
    } catch {
      /* connector slow/unavailable → keep the fallback name */
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-stone-900">
            Welcome, {businessName}
          </h1>
          {profileUrl && <TitleQrButton url={profileUrl} businessName={businessName} />}
          {!demo && (
            <div className="ml-auto shrink-0">
              <VendorSignOut />
            </div>
          )}
        </div>
        {user?.email && <p className="mt-1 text-sm text-stone-500">{user.email}</p>}
      </div>

      {/* Profile-link banner — shown until a member profile is claimed (not in demo) */}
      {!demo && !profile && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
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

      {/* The path to a first sale. Replaces a Stripe banner that could never
          render (it needed a stripe_connect_accounts row, which only the
          unreachable create-account route could write) and linked to a public
          profile page that ignored the param it passed. */}
      {!demo && profile && sellSteps && <SellChecklist steps={sellSteps} />}

      <VendorHome
        orderCount={orderCount}
        plan={plan}
        planLabel={planLabel}
        memberId={memberId}
        memberName={businessName}
        isAdmin={admin}
        demo={demo}
      />
    </div>
  );
}
