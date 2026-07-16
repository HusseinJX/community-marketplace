import { redirect } from "next/navigation";

// Collabs merged into the single Messages inbox (Collaborations + Customers).
// This route stays so existing links — push-notification deep links, bookmarks,
// the dashboard's "All collaborations" — keep working.
export default async function VendorNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { memberId } = await searchParams;
  const qs = memberId ? `&memberId=${encodeURIComponent(memberId)}` : "";
  redirect(`/vendor/messages?tab=collabs${qs}`);
}
