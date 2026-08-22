import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { CreditCard, ExternalLink, UserCircle } from "lucide-react";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { getEntitlements, PLAN_META } from "@/lib/entitlements";
import { HubTile } from "@/components/vendor/HubTile";

export const metadata = { title: "Profile" };

// The Profile button opens THIS, not the edit form.
//
// "Profile" means the page people read about you and what you pay us to have
// it. Opening straight into a form full of text fields answered only half of
// that, and a form that opens on tap is a form you can edit by accident.
//
// The agent, giving and resources used to be here and moved to /vendor/tools —
// none of them appear on the profile, and "things you use" is a different
// question from "who you are".
export default async function VendorProfileHubPage({
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

  return (
    <div className="space-y-6">
      {/* The public page is a PILL on the title row, not a tile in the list.
          It is the only item here that leaves the portal — it doesn't manage
          anything, it shows you the thing all of this is about — and as a tile
          it read as a fourth setting. On the title row it reads as what it is:
          "here's mine". */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Profile</h1>
          <p className="mt-1 text-sm text-stone-500">Your page, and your plan.</p>
        </div>
        {memberId && (
          <Link
            href={`/members/${memberId}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-stone-800 transition hover:border-stone-900"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View public page
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HubTile
          href="/vendor/about"
          Icon={UserCircle}
          label="Edit profile"
          desc="Photos, details & all your links"
        />
        <HubTile
          href="/vendor/billing"
          Icon={CreditCard}
          label="Plan & billing"
          desc={`Current plan: ${PLAN_META[plan].label}`}
        />
      </div>
    </div>
  );
}
