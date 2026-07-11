import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { getMember } from "@/lib/api";
import { LiveManager } from "./LiveManager";

export default async function VendorLivePage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { userId } = await auth();
  const { memberId: requested } = await searchParams;
  const profile = userId ? await getVendorProfile(userId) : null;
  const admin = isAdmin(userId);
  let memberId = admin && requested ? requested : profile?.member_id;
  if (!memberId && !userId && (await isDemoActive())) memberId = await demoMemberId();

  if (!memberId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-900">Link your member profile first</p>
        <p className="mt-1 text-sm text-amber-700">
          Connect your store profile to broadcast what you&apos;re showing live.
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

  let memberName = "Venue";
  try {
    const m = await getMember(memberId);
    memberName =
      (m.member.profile?.businessName as string) || (m.member.profile?.name as string) || memberName;
  } catch {
    /* keep default */
  }

  return <LiveManager memberId={memberId} memberName={memberName} isAdmin={admin} />;
}
