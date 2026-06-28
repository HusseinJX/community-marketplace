import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLiveBroadcasts, getSaveCounts, getSavedBroadcastIds } from "@/lib/broadcasts";

// Public "Live Now" feed. ?event=<slug> filters to one event group.
// When signed in, each item is annotated with `saved` for the current user.
export async function GET(req: Request) {
  const event = new URL(req.url).searchParams.get("event");
  const broadcasts = await getLiveBroadcasts(event);

  const ids = broadcasts.map((b) => b.id);
  const counts = await getSaveCounts(ids);

  const { userId } = await auth();
  const savedSet = userId ? new Set(await getSavedBroadcastIds(userId)) : new Set<string>();

  const items = broadcasts.map((b) => ({
    ...b,
    save_count: counts[b.id] ?? 0,
    saved: savedSet.has(b.id),
  }));

  return NextResponse.json({ broadcasts: items });
}
