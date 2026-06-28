// Shape returned by GET /api/broadcasts (a Broadcast + save annotations).
export interface LiveBroadcast {
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
  save_count: number;
  saved: boolean;
}
