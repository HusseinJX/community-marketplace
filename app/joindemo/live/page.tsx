import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { JoinDemoGate } from "@/components/join/JoinDemoGate";
import { isJoinDemoActive } from "@/lib/joindemo";
import { isAdmin } from "@/lib/admin";
import { LiveCanvass } from "./LiveCanvass";

export const metadata: Metadata = {
  title: "Live canvass",
  robots: { index: false, follow: false },
};

// The REAL half of /joindemo: search a business someone names out loud, see the
// Google Maps facts and a web-researched story side by side, then create an
// unclaimed profile for them.
//
// /joindemo (the walkthrough) is untouched and still writes nothing. This is a
// separate door on purpose — the two do opposite things, and a toggle inside
// one screen is how a demo eventually creates a real row by accident.
export const dynamic = "force-dynamic";

export default async function LiveCanvassPage() {
  const unlocked = await isJoinDemoActive();
  if (!unlocked) return <JoinDemoGate />;

  // Told to the page, not discovered at the moment of pressing Create — finding
  // out you're signed out in front of an audience is the failure this avoids.
  const { userId } = await auth();
  return <LiveCanvass canCreate={isAdmin(userId)} signedIn={!!userId} />;
}
