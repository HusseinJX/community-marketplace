import { auth, currentUser } from '@clerk/nextjs/server'
import Link from "next/link";
import { getVendorProfile, getVendorConnectAccount, getOrdersByMember } from "@/lib/vendor-connect";
import { stripe } from "@/lib/stripe-server";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { getMember } from "@/lib/api";
import { getEntitlements, PLAN_META } from "@/lib/entitlements";
import { SITE_URL } from "@/lib/seo";
import { VendorHome } from "@/components/vendor/VendorHome";
import { TitleQrButton } from "@/components/vendor/TitleQrButton";

export default async function VendorDashboard() {
  const { userId } = await auth()
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

  // Tools that aren't in the slim top nav (Home/Live/Collabs/Resources/QR).
  // (Network lives under Collabs; Organize lives under My Events; Onboard hidden.)
  // Super-admin + Featured are intentionally NOT listed — the super-admin dash is
  // reachable only via its direct URL (/vendor/admin).
  const entitlements = profile ? await getEntitlements(profile.member_id) : null;
  const plan = entitlements?.plan ?? (demo ? "pro" : "free");
  const planLabel = PLAN_META[plan].label;

  const memberId = profile?.member_id ?? (demo ? await demoMemberId() : null);
  const profileUrl = memberId ? `${SITE_URL}/members/${memberId}` : null;

  // Business name + about details — live on the member record, not vendor_profiles.
  let businessName = user?.firstName || "your business";
  let about: {
    bio?: string; category?: string; city?: string; neighborhood?: string;
    instagram?: string; website?: string;
  } | null = null;
  if (memberId) {
    try {
      const m = await getMember(memberId);
      const p = (m as {
        member?: {
          profile?: {
            businessName?: string; name?: string; businessDescription?: string; bio?: string;
            category?: string; city?: string; neighborhood?: string;
            instagramHandle?: string; websiteUrl?: string;
          };
        };
      })?.member?.profile;
      businessName = p?.businessName || p?.name || businessName;
      about = {
        bio: p?.businessDescription || p?.bio || undefined,
        category: p?.category || undefined,
        city: p?.city || undefined,
        neighborhood: p?.neighborhood || undefined,
        instagram: p?.instagramHandle || undefined,
        website: p?.websiteUrl || undefined,
      };
    } catch {
      /* connector slow/unavailable → keep the fallback name */
    }
  }

  return (
    <div className="space-y-8">
      <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />

      {/* Welcome */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-stone-900">
            Welcome, {businessName}
          </h1>
          {profileUrl && <TitleQrButton url={profileUrl} businessName={businessName} />}
        </div>
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

      <VendorHome orderCount={orderCount} plan={plan} planLabel={planLabel} about={about} memberId={memberId} />
    </div>
  );
}
