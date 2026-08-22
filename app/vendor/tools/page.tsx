import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Heart, LifeBuoy, MessageCircle } from "lucide-react";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { getEntitlements } from "@/lib/entitlements";
import { HubTile } from "@/components/vendor/HubTile";
import { NativeGate } from "@/components/billing/NativeGate";

export const metadata = { title: "Tools" };

// Things a business USES, as opposed to things it IS.
//
// The agent, giving and resources started out on the Profile hub, which was
// wrong by one word: a profile is what people read about you, and none of these
// three appear on it. They are equipment — something answering your phone,
// somewhere to log what you gave, somewhere to find a grant.
export default async function VendorToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { userId } = await auth();
  const { memberId: requested } = await searchParams;
  const profile = userId ? await getVendorProfile(userId) : null;
  const admin = isAdmin(userId);
  const demo = !userId && (await isDemoActive());
  const memberId = (admin && requested) || profile?.member_id || (demo ? await demoMemberId() : null);

  const entitlements = memberId ? await getEntitlements(memberId) : null;
  const plan = entitlements?.plan ?? (demo ? "pro" : "free");
  const isPro = plan === "pro" || plan === "enterprise";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Tools</h1>
        <p className="mt-1 text-sm text-stone-500">
          Your agent, what you give back, and what the city offers you.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* The agent is what Pro actually is now (selling went free
            2026-08-14). Shown either way: to a Pro vendor it's the thing they
            bought, to everyone else it's the one thing worth knowing Pro is
            for — but a PRICE only ever renders on web (Apple 3.1.1: an in-app
            price must come from StoreKit, which /vendor/billing does). */}
        <HubTile
          href={isPro ? "/vendor/assistant" : "/vendor/billing"}
          Icon={MessageCircle}
          label="Your agent"
          desc={isPro ? "Train your customer-service AI" : "Let an AI answer your customers · Pro"}
        />
        <HubTile href="/vendor/giving" Icon={Heart} label="Giving" desc="Log a gift to a local org" />
        <HubTile
          href="/vendor/resources"
          Icon={LifeBuoy}
          label="Resources"
          desc="Grants, permits & local programs"
        />
      </div>

      {!isPro && (
        <NativeGate>
          <div className="card-soft p-4">
            <p className="text-[15px] font-semibold text-stone-900">
              Let an AI answer your customers
            </p>
            <p className="mt-1 text-[13px] leading-snug text-stone-600">
              Your own agent replies to questions by text and by phone, trained on your business.
              Pro is $30/mo. Selling stays free either way — we take 5% of a sale, and nothing when
              you don&apos;t sell.
            </p>
            <Link
              href="/vendor/billing"
              className="mt-3 inline-flex rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-800"
            >
              See plans
            </Link>
          </div>
        </NativeGate>
      )}
    </div>
  );
}
