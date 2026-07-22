import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendPushToUser, pushConfigured } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

// POST — send a test push to the signed-in user's registered devices. Handy for
// verifying the full APNs pipeline end-to-end from the phone.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const limited = rateLimit({ req: request, name: "push-test", id: userId, limit: 5, windowMs: 60_000 });
  if (limited) return limited
  if (!pushConfigured()) return NextResponse.json({ error: "APNS_* env not set" }, { status: 503 });

  const sent = await sendPushToUser(userId, {
    title: "WhatsLocal",
    body: "🎉 Push notifications are working!",
    url: "/",
  });
  return NextResponse.json({ ok: true, sent });
}
