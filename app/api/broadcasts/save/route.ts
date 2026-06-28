import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveBroadcast, unsaveBroadcast, getSavedBroadcastIds } from "@/lib/broadcasts";

// GET — the current user's saved broadcast ids (for hydrating heart state).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ saved: [] });
  return NextResponse.json({ saved: await getSavedBroadcastIds(userId) });
}

// POST — { broadcastId, action: "save" | "unsave" }
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to save" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const broadcastId = String(body.broadcastId ?? "");
  if (!broadcastId) return NextResponse.json({ error: "Missing broadcastId" }, { status: 400 });

  if (body.action === "unsave") {
    await unsaveBroadcast(broadcastId, userId);
    return NextResponse.json({ saved: false });
  }
  await saveBroadcast(broadcastId, userId);
  return NextResponse.json({ saved: true });
}
