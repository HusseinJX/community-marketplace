import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getVendorEventById } from "@/lib/vendor-connect";
import { resolveActor } from "@/lib/admin";
import { CheckInScanner } from "@/components/vendor/CheckInScanner";

export const metadata = { title: "Check in" };

// The door screen. Inside /vendor so it inherits the portal's auth, and gated
// again here on being the event's host — an organizer must never be able to
// open someone else's door.
export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getVendorEventById(eventId);
  if (!event) notFound();

  const actor = await resolveActor(event.member_id);
  if (!actor || actor.memberId !== event.member_id) redirect("/vendor/organize");

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <Link
        href="/vendor/organize"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        <ChevronLeft className="h-4 w-4" /> Events
      </Link>
      <h1 className="mb-4 mt-3 text-2xl font-bold tracking-tight text-stone-900">Check in</h1>
      <CheckInScanner eventId={event.id} eventTitle={event.title} />
    </main>
  );
}
