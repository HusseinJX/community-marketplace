import type { Metadata } from "next";
import { getVendorEventById } from "@/lib/vendor-connect";
import { OnboardChat } from "./OnboardChat";

export const metadata: Metadata = { title: "Join WhatsLocal", robots: { index: false } };

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: eventId } = await searchParams;
  const event = eventId ? await getVendorEventById(eventId) : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
        {event ? "Vendor sign-up" : "Join the community"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-stone-900">
        {event ? `Join ${event.title}` : "Get your business on WhatsLocal"}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Chat with us for a minute and we&apos;ll set up your profile.
      </p>
      <div className="mt-5">
        <OnboardChat eventId={event?.id ?? null} eventName={event?.title ?? null} />
      </div>
      {event && (
        <p className="mt-4 text-center text-xs text-stone-400">
          Already on WhatsLocal?{" "}
          <a href={`/events/${event.id}/join`} className="font-medium text-indigo-600 hover:underline">
            Find your existing listing
          </a>
        </p>
      )}
    </main>
  );
}
