import Link from "next/link";
import type { Metadata } from "next";
import { getVendorEventById } from "@/lib/vendor-connect";
import { JoinForm } from "./JoinForm";

// NOTE: slug is `[id]` to match the sibling `app/events/[id]/page.tsx` — Next
// forbids two different slug names (`[id]` vs `[eventId]`) at the same level.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getVendorEventById(id);
  return { title: event ? `Join ${event.title}` : "Join event", robots: { index: false } };
}

export default async function EventJoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getVendorEventById(id);

  if (!event) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-stone-500">This event link is no longer active.</p>
        <Link href="/events" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Browse events →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Vendor sign-up</p>
      <h1 className="mt-1 text-xl font-semibold text-stone-900">Join {event.title}</h1>
      <p className="mt-1 text-sm text-stone-500">
        {[event.event_date, event.location].filter(Boolean).join(" · ") ||
          "Add your business to this event's vendor lineup."}
      </p>
      <div className="mt-6">
        <JoinForm eventId={id} hostName={event.member_name ?? "the organizer"} />
      </div>
    </main>
  );
}
