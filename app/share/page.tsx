import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getVendorProfile } from "@/lib/vendor-connect";
import { isDemoActive } from "@/lib/demo-server";
import { ShareComposer } from "@/components/share/ShareComposer";

export const metadata = { title: "Share" };

// /share is TWO doors wearing one URL, and only one of them is for everybody.
//
//  - Bare (`/share`, `/share?vendor=1`) is the business composer the top-nav
//    "+" used to open for anyone. Posting as a business is a business action,
//    so this door is vendors only. Hiding the "+" (TopNav → useMyMemberId) was
//    never access control: the URL is still typeable, bookmarkable, and sitting
//    in browser history from before the nav changed.
//
//  - Tagged (`?business=…`, `?event=…`) is the memories flow — "📸 Been here?
//    Post a photo" on a profile, "Tag" on an event, "Post your vibe" on a live
//    broadcast. Those walls exist to gather what the CROWD posted, so gating
//    them to vendors would quietly empty the feature they feed. Any signed-in
//    person may walk through it.
//
// Signed-out goes home either way. Not to the vendor sign-in page: most people
// arriving here are shoppers following one of those CTAs, and answering a photo
// prompt with a business login is a worse dead end than the home page.
//
// Server-side, like the vendor bounce on /shopper, so nobody watches a composer
// appear and then get taken away.
//
// The admin demo is let through — it has no Clerk user to look up, and
// previewing this composer is exactly what it is for. Its writes already no-op
// (resolveActor has no demo path).
export const dynamic = "force-dynamic";

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tagged = !!(sp.business || sp.event);

  const { userId } = await auth();
  if (!userId) {
    if (await isDemoActive()) return <ShareComposer />;
    redirect("/");
  }

  if (tagged) return <ShareComposer />;

  // A lookup failure sends a real vendor home rather than opening the composer.
  // Fails closed on purpose — during a Supabase outage the composer could not
  // resolve who to post as anyway.
  const vendor = await getVendorProfile(userId).catch(() => null);
  if (!vendor?.member_id) redirect("/");

  return <ShareComposer />;
}
