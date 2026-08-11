import { redirect } from "next/navigation";
import { resolveActor } from "@/lib/admin";
import { BookingsManager } from "./BookingsManager";

export const metadata = { title: "Bookings" };

export default async function VendorBookingsPage() {
  const actor = await resolveActor(null);
  if (!actor) redirect("/vendor/setup");
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <h1 className="text-xl font-semibold text-stone-900">Bookings</h1>
      <p className="mt-1 text-sm text-stone-500">
        People asking for a time. Nothing is booked until you say yes.
      </p>
      <BookingsManager />
    </main>
  );
}
