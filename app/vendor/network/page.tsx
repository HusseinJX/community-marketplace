import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { getEntitlements } from "@/lib/entitlements";
import { CollabsGate } from "@/components/vendor/CollabsGate";
import { NetworkManager } from "./NetworkManager";

export default async function VendorNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { userId } = await auth();
  const { memberId: requested } = await searchParams;
  const profile = userId ? await getVendorProfile(userId) : null;
  const admin = isAdmin(userId);
  let memberId = admin && requested ? requested : profile?.member_id;
  const adminDemo = !userId && (await isDemoActive());
  if (!memberId && adminDemo) memberId = await demoMemberId();

  if (!memberId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">Link your member profile first</p>
        <p className="mt-1 text-sm text-amber-700">
          Connect your profile to find collaborators and send invites.
        </p>
        <Link
          href="/vendor/setup"
          className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
        >
          Get started
        </Link>
      </div>
    );
  }

  const { plan } = await getEntitlements(memberId);

  return (
    <CollabsGate plan={plan} adminDemo={adminDemo}>
      <NetworkManager memberId={memberId} isAdmin={admin} />
    </CollabsGate>
  );
}
