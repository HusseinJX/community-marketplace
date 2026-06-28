import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBroadcastById, getSaveCounts, getSavedBroadcastIds } from "@/lib/broadcasts";

// Single broadcast for the live-event page (/live/[id]).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const broadcast = await getBroadcastById(id);
  if (!broadcast) return NextResponse.json({ broadcast: null }, { status: 404 });

  const counts = await getSaveCounts([id]);
  const { userId } = await auth();
  const saved = userId ? (await getSavedBroadcastIds(userId)).includes(id) : false;

  return NextResponse.json({
    broadcast: { ...broadcast, save_count: counts[id] ?? 0, saved },
  });
}
