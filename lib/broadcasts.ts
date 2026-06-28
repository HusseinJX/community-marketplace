import { createClient } from "@supabase/supabase-js";

// Vendor write paths use the anon key (open RLS + explicit grants), matching
// lib/vendor-connect.ts. Prefer the service-role key when present for writes.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

export interface Broadcast {
  id: string;
  member_id: string;
  member_name: string | null;
  event_slug: string;
  event_label: string | null;
  whats_on: string | null;
  note: string | null;
  supports_team: string | null;
  image_urls: string[];
  livestream_url: string | null;
  starts_at: string;
  ends_at: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  city: string | null;
  active: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface NewBroadcast {
  event_slug: string;
  event_label?: string | null;
  whats_on?: string | null;
  note?: string | null;
  supports_team?: string | null;
  image_urls?: string[];
  livestream_url?: string | null;
  starts_at?: string | null;
  ends_at: string;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood?: string | null;
  city?: string | null;
  source?: string;
}

// Public live feed — active broadcasts whose window contains "now".
export async function getLiveBroadcasts(
  eventSlug?: string | null,
  team?: string | null
): Promise<Broadcast[]> {
  const nowIso = new Date().toISOString();
  let q = supabase
    .from("broadcasts")
    .select("*")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  if (eventSlug) q = q.eq("event_slug", eventSlug);
  if (team) q = q.ilike("supports_team", team);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Broadcast[];
}

// A single broadcast by id (for the live-event page).
export async function getBroadcastById(id: string): Promise<Broadcast | null> {
  const { data, error } = await supabase.from("broadcasts").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as Broadcast;
}

// A single member's broadcasts. Owner view (includeExpired) shows past ones too.
export async function getBroadcastsByMember(
  memberId: string,
  includeExpired = false
): Promise<Broadcast[]> {
  let q = supabase.from("broadcasts").select("*").eq("member_id", memberId);
  if (!includeExpired) {
    const nowIso = new Date().toISOString();
    q = q.eq("active", true).gt("ends_at", nowIso);
  }
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Broadcast[];
}

export async function createBroadcast(
  memberId: string,
  memberName: string,
  b: NewBroadcast
): Promise<Broadcast> {
  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      member_id: memberId,
      member_name: memberName,
      event_slug: b.event_slug,
      event_label: b.event_label ?? null,
      whats_on: b.whats_on ?? null,
      note: b.note ?? null,
      supports_team: b.supports_team ?? null,
      image_urls: b.image_urls ?? [],
      livestream_url: b.livestream_url ?? null,
      starts_at: b.starts_at ?? new Date().toISOString(),
      ends_at: b.ends_at,
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      neighborhood: b.neighborhood ?? null,
      city: b.city ?? null,
      source: b.source ?? "manual",
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create broadcast: ${error?.message}`);
  return data as Broadcast;
}

export async function updateBroadcast(
  id: string,
  memberId: string,
  fields: Partial<Pick<Broadcast, "event_slug" | "event_label" | "whats_on" | "note" | "supports_team" | "image_urls" | "livestream_url" | "starts_at" | "ends_at" | "active">>
): Promise<void> {
  const { error } = await supabase
    .from("broadcasts")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) throw new Error(`Failed to update broadcast: ${error.message}`);
}

export async function deleteBroadcast(id: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from("broadcasts")
    .delete()
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) throw new Error(`Failed to delete broadcast: ${error.message}`);
}

// ── Saves (shopper reactions) ──────────────────────────────────────────────────

export async function saveBroadcast(broadcastId: string, clerkUserId: string): Promise<void> {
  const { error } = await supabase
    .from("broadcast_saves")
    .upsert({ broadcast_id: broadcastId, clerk_user_id: clerkUserId }, { onConflict: "broadcast_id,clerk_user_id" });
  if (error) throw new Error(`Failed to save broadcast: ${error.message}`);
}

export async function unsaveBroadcast(broadcastId: string, clerkUserId: string): Promise<void> {
  const { error } = await supabase
    .from("broadcast_saves")
    .delete()
    .eq("broadcast_id", broadcastId)
    .eq("clerk_user_id", clerkUserId);
  if (error) throw new Error(`Failed to unsave broadcast: ${error.message}`);
}

export async function getSavedBroadcastIds(clerkUserId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("broadcast_saves")
    .select("broadcast_id")
    .eq("clerk_user_id", clerkUserId);
  if (error || !data) return [];
  return (data as { broadcast_id: string }[]).map((r) => r.broadcast_id);
}

export async function getSaveCounts(broadcastIds: string[]): Promise<Record<string, number>> {
  if (broadcastIds.length === 0) return {};
  const { data, error } = await supabase
    .from("broadcast_saves")
    .select("broadcast_id")
    .in("broadcast_id", broadcastIds);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const r of data as { broadcast_id: string }[]) {
    counts[r.broadcast_id] = (counts[r.broadcast_id] ?? 0) + 1;
  }
  return counts;
}
