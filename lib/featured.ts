import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

export interface FeaturedList {
  id: string;
  title: string;
  subtitle: string | null;
  event_slug: string | null;
  supports_team: string | null;
  member_ids: string[];
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewFeaturedList {
  title: string;
  subtitle?: string | null;
  event_slug?: string | null;
  supports_team?: string | null;
  member_ids?: string[];
  sort_order?: number;
  active?: boolean;
}

export async function getFeaturedLists(includeInactive = false): Promise<FeaturedList[]> {
  let q = supabase.from("featured_lists").select("*");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as FeaturedList[];
}

export async function createFeaturedList(l: NewFeaturedList): Promise<FeaturedList> {
  const { data, error } = await supabase
    .from("featured_lists")
    .insert({
      title: l.title,
      subtitle: l.subtitle ?? null,
      event_slug: l.event_slug ?? null,
      supports_team: l.supports_team ?? null,
      member_ids: l.member_ids ?? [],
      sort_order: l.sort_order ?? 0,
      active: l.active ?? true,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create featured list: ${error?.message}`);
  return data as FeaturedList;
}

export async function updateFeaturedList(
  id: string,
  fields: Partial<NewFeaturedList>
): Promise<void> {
  const { error } = await supabase
    .from("featured_lists")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to update featured list: ${error.message}`);
}

export async function deleteFeaturedList(id: string): Promise<void> {
  const { error } = await supabase.from("featured_lists").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete featured list: ${error.message}`);
}
