import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveDeviceToken } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

// POST — the native app registers its APNs device token here. Links it to the
// signed-in Clerk user (if any) so pushes can target the person. Anonymous
// devices are still stored; they get associated once the user signs in and the
// app re-registers.
export async function POST(request: Request) {
  try {
    // Anonymous devices allowed → per-IP guard against token flooding.
    const limited = rateLimit({ req: request, name: "push-register", id: null, limit: 20, windowMs: 60_000, ipLimit: 20 });
    if (limited) return limited

    const { token, platform } = await request.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    const { userId } = await auth();
    await saveDeviceToken(token, userId ?? null, typeof platform === "string" ? platform : "ios");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
