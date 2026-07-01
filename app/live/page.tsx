import { redirect } from "next/navigation";

// The Live feed now lives at the index ("/"). Keep this route as a redirect so
// existing /live and /live?event=… deep links (cards, emails, QR) still work.
export default async function LiveRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const event = typeof sp.event === "string" ? sp.event : undefined;
  redirect(event ? `/?event=${encodeURIComponent(event)}` : "/");
}
