import { MyTickets } from "@/components/events/MyTickets";

export const metadata = {
  title: "My tickets",
  robots: { index: false, follow: false },
};

// Upcoming and past in one place — "events I've attended" is this list read
// backwards, so there's no separate history screen to keep in sync.
export default function TicketsPage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-5">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">My tickets</h1>
      <MyTickets />
    </main>
  );
}
