import { createClient } from "@supabase/supabase-js";
import { createSign } from "node:crypto";
import http2 from "node:http2";

// Native APNs push — no third-party service. Device registration is stored in
// `device_tokens`; sending signs an ES256 JWT with the .p8 auth key and posts to
// Apple's HTTP/2 endpoint. Everything no-ops until the APNS_* env is set.

// Server-only, server-to-server reads/writes — prefer the service-role key so RLS
// (which revoked anon grants on several tables) can't silently block token lookups.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// ── Registration ────────────────────────────────────────────────────────────
export async function saveDeviceToken(token: string, clerkUserId: string | null, platform = "ios") {
  await supabase
    .from("device_tokens")
    .upsert(
      { token, clerk_user_id: clerkUserId, platform, updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );
}

// ── Sending ─────────────────────────────────────────────────────────────────
interface PushPayload { title: string; body: string; url?: string; badge?: number }

function apnsConfig() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID || "ai.whatslocal.app";
  // The .p8 contents (PEM). Newlines may arrive escaped from env — normalize.
  const key = process.env.APNS_KEY?.replace(/\\n/g, "\n");
  // Dev/TestFlight-debug tokens use the sandbox host; App Store uses production.
  const host = process.env.APNS_ENV === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  if (!keyId || !teamId || !key) return null;
  return { keyId, teamId, bundleId, key, host };
}

export function pushConfigured(): boolean {
  return apnsConfig() !== null;
}

// A short-lived ES256 JWT proving the request comes from our team/key.
function providerToken(cfg: { keyId: string; teamId: string; key: string }): string {
  const header = { alg: "ES256", kid: cfg.keyId };
  const claims = { iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) };
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(claims)}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  const signature = signer.sign({ key: cfg.key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function sendToToken(
  cfg: NonNullable<ReturnType<typeof apnsConfig>>,
  jwt: string,
  deviceToken: string,
  payload: PushPayload
): Promise<{ ok: boolean; status: number; reason?: string }> {
  return new Promise((resolve) => {
    const client = http2.connect(cfg.host);
    client.on("error", () => resolve({ ok: false, status: 0, reason: "connect_error" }));
    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default", badge: payload.badge },
      url: payload.url,
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      authorization: `bearer ${jwt}`,
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => { status = Number(h[":status"]) || 0; });
    req.on("data", (c) => { data += c; });
    req.on("end", () => {
      client.close();
      if (status === 200) resolve({ ok: true, status });
      else {
        let reason: string | undefined;
        try { reason = JSON.parse(data).reason; } catch { /* ignore */ }
        resolve({ ok: false, status, reason });
      }
    });
    req.on("error", () => { client.close(); resolve({ ok: false, status: 0, reason: "request_error" }); });
    req.end(body);
  });
}

// Resolve the Clerk user(s) who own a member (via vendor_profiles). A member can
// in principle be linked by more than one Clerk account, so this returns a list.
export async function clerkIdsForMember(memberId: string): Promise<string[]> {
  const { data } = await supabase
    .from("vendor_profiles")
    .select("clerk_user_id")
    .eq("member_id", memberId);
  return (data ?? []).map((r) => r.clerk_user_id as string).filter(Boolean);
}

// Push to a member (business/organizer) — bridges member_id → clerk_user_id →
// devices. Collab invites, room messages, and event invites are member-keyed, so
// this is the entry point for all of them. No-ops safely when unconfigured/unlinked.
export async function notifyMember(memberId: string, payload: PushPayload): Promise<number> {
  if (!apnsConfig()) return 0;
  const clerkIds = await clerkIdsForMember(memberId);
  if (!clerkIds.length) return 0;
  let sent = 0;
  for (const id of clerkIds) sent += await sendPushToUser(id, payload);
  return sent;
}

// Fire-and-forget wrapper for use in request handlers: never throws, never blocks
// the response. Callers do `void notify(...)`.
export async function notifyMemberSafe(memberId: string, payload: PushPayload): Promise<void> {
  try { await notifyMember(memberId, payload); } catch { /* push is best-effort */ }
}

// Send a push to every device belonging to a Clerk user. No-ops (returns 0) when
// APNs env isn't configured. Prunes tokens Apple reports as gone.
export async function sendPushToUser(clerkUserId: string, payload: PushPayload): Promise<number> {
  const cfg = apnsConfig();
  if (!cfg) return 0;
  const { data } = await supabase.from("device_tokens").select("token").eq("clerk_user_id", clerkUserId);
  const tokens = (data ?? []).map((r) => r.token as string);
  if (!tokens.length) return 0;

  const jwt = providerToken(cfg);
  let sent = 0;
  const dead: string[] = [];
  for (const t of tokens) {
    const res = await sendToToken(cfg, jwt, t, payload);
    if (res.ok) sent++;
    else if (res.status === 410 || res.reason === "BadDeviceToken" || res.reason === "Unregistered") dead.push(t);
  }
  if (dead.length) await supabase.from("device_tokens").delete().in("token", dead);
  return sent;
}
