import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getVendorProfile, getVendorEventById, type VendorEvent } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { demoEvents, isDemoEventId } from "@/lib/demo-organize";
import { emailConfigured } from "@/lib/email";
import { EventManager } from "./EventManager";

export default async function VendorEventManagePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { userId } = await auth();
  const profile = userId ? await getVendorProfile(userId) : null;
  const admin = isAdmin(userId);
  const demo = !userId && (await isDemoActive());

  let memberId = profile?.member_id ?? null;
  if (!memberId && demo) memberId = await demoMemberId();

  // Resolve the event (demo events come from fixtures).
  let event: VendorEvent | null = null;
  if (demo && isDemoEventId(eventId)) {
    event = demoEvents(memberId ?? "demo").find((e) => e.id === eventId) ?? null;
  } else {
    event = await getVendorEventById(eventId);
  }

  if (!event) {
    return <NotFound />;
  }

  // Only the owner (or an admin) may manage it.
  if (!admin && !demo && event.member_id !== memberId) {
    return <NotFound />;
  }

  return (
    <EventManager event={event} memberId={event.member_id} isAdmin={admin} emailReady={emailConfigured()} />
  );
}

function NotFound() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
      <p className="text-sm text-stone-500">Event not found, or you don&apos;t manage it.</p>
      <Link href="/vendor/events" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
        Back to events
      </Link>
    </div>
  );
}
