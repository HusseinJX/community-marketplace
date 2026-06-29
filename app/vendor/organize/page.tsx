import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { isDemoMode } from "@/lib/demo-admin";
import { demoMemberId } from "@/lib/demo-server";
import { emailConfigured } from "@/lib/email";
import { getMember } from "@/lib/api";
import { isEventOrganizer } from "@/lib/org-focus";
import { OrganizeManager } from "./OrganizeManager";

export default async function VendorOrganizePage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { userId } = await auth();
  const { memberId: requested } = await searchParams;
  const profile = userId ? await getVendorProfile(userId) : null;
  const admin = isAdmin(userId);
  let memberId = admin && requested ? requested : profile?.member_id;
  if (!memberId && !userId && isDemoMode()) memberId = await demoMemberId();

  if (!memberId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-900">Link your member profile first</p>
        <p className="mt-1 text-sm text-amber-700">
          Connect your profile to organize events, build a vendor lineup, and message everyone.
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

  let eventOrganizer = false;
  try {
    const m = await getMember(memberId);
    eventOrganizer = isEventOrganizer(m.member.profile);
  } catch {
    /* default to generic organizer copy */
  }

  return (
    <OrganizeManager
      memberId={memberId}
      isAdmin={admin}
      emailReady={emailConfigured()}
      eventOrganizer={eventOrganizer}
    />
  );
}
