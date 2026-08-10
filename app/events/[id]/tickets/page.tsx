import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getVendorEventById } from "@/lib/vendor-connect";
import { getAvailability, publicTicketType } from "@/lib/tickets";
import { TicketCheckout } from "@/components/events/TicketCheckout";

export const metadata = { title: "Get tickets" };

// Ticket checkout is its own page rather than a modal on the event: it's a
// payment step that people arrive at from an email or a shared link, so it has
// to survive a reload and be linkable on its own.
export default async function TicketCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const event = await getVendorEventById(id);
  if (!event) notFound();

  const types = await getAvailability(id);
  if (types.length === 0) notFound();

  // The selection rides in the query string (?<typeId>=<qty>) so a half-filled
  // checkout can be reloaded or shared without losing what was picked.
  const selection = types
    .map((t) => ({ id: t.id, quantity: Number(query[t.id] ?? 0) || 0 }))
    .filter((s) => s.quantity > 0);

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <Link
        href={`/events/${id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        <ChevronLeft className="h-4 w-4" /> {event.title}
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900">Get tickets</h1>
      <p className="mt-1 text-sm text-stone-500">
        {[event.event_date, event.event_time, event.location].filter(Boolean).join(" · ")}
      </p>

      <TicketCheckout
        eventId={id}
        eventTitle={event.title}
        types={types.map(publicTicketType)}
        initialSelection={selection}
      />
    </main>
  );
}
