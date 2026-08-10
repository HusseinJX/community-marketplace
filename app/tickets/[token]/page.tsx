import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { getTicketByToken } from "@/lib/tickets";
import { getVendorEventById } from "@/lib/vendor-connect";

// The ticket itself. Deliberately a plain server-rendered page with no auth
// gate: the token in the URL is the credential, because the person holding it
// may have no account at all. Never indexed — see the metadata below.
export const metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
};

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await getTicketByToken(token);
  if (!ticket) notFound();

  const event = await getVendorEventById(ticket.event_id);
  const when = [event?.event_date, event?.event_time].filter(Boolean).join(" · ");
  const voided = ticket.status === "cancelled" || ticket.status === "refunded";
  const used = ticket.status === "checked_in";

  return (
    <main className="mx-auto max-w-sm px-4 pb-24 pt-6">
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-dashed border-stone-200 px-5 py-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
            {ticket.ticket_type_name ?? "Admission"}
          </p>
          <h1 className="mt-1 text-xl font-bold leading-tight text-stone-900">
            {event?.title ?? "Event"}
          </h1>
          {when && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-stone-600">
              <Calendar className="h-3.5 w-3.5" /> {when}
            </p>
          )}
          {event?.location && (
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-stone-600">
              <MapPin className="h-3.5 w-3.5" /> {event.location}
            </p>
          )}
        </div>

        <div className="px-5 py-6 text-center">
          {voided ? (
            <div className="py-6">
              <XCircle className="mx-auto h-10 w-10 text-rose-500" />
              <p className="mt-2 font-semibold text-stone-900">
                This ticket was {ticket.status === "refunded" ? "refunded" : "cancelled"}
              </p>
              <p className="mt-1 text-sm text-stone-500">It won&apos;t scan at the door.</p>
            </div>
          ) : (
            <>
              {/* Served by our own route rather than next/image: it's per-ticket,
                  no-store, and must never be optimised into a shared CDN cache. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/tickets/${ticket.token}/qr.png`}
                alt="Ticket QR code"
                width={240}
                height={240}
                className={"mx-auto h-60 w-60 rounded-xl " + (used ? "opacity-30" : "")}
              />
              <p className="mt-3 font-mono text-lg font-semibold tracking-[0.2em] text-stone-900">
                {ticket.code}
              </p>
              {used ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Checked in
                  {ticket.checked_in_at
                    ? ` at ${new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-stone-500">Show this at the door</p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-stone-100 px-5 py-3 text-center text-xs text-stone-500">
          {ticket.buyer_name ? `${ticket.buyer_name} · ` : ""}
          {ticket.price_cents > 0 ? `$${(ticket.price_cents / 100).toFixed(2)}` : "Free"}
          {event?.member_name ? ` · ${event.member_name}` : ""}
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-3 text-sm">
        {event && (
          <Link href={`/events/${event.id}`} className="font-medium text-indigo-600 hover:underline">
            Event details
          </Link>
        )}
        <Link href="/tickets" className="font-medium text-stone-500 hover:underline">
          All my tickets
        </Link>
      </div>
    </main>
  );
}
