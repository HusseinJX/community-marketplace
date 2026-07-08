// Launch seed — makes the live/feed/featured surfaces look alive using REAL
// businesses (pulled from the connector), not hardcoded fake data. Every row is
// a genuine Supabase row referencing a real member id / name / coords / photos,
// marked so a re-run replaces (not duplicates) it.
//
//   broadcasts    → source = 'seed'      (deleted + reinserted each run)
//   posts         → author_id = 'seed'   (deleted + reinserted each run)
//   featured_lists→ sort_order >= 900    (deleted + reinserted each run)
//
// Run against whatever env is loaded (point it at PROD to seed prod):
//   node --env-file=.env.local scripts/seed-launch.mjs
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_API_BASE.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
// Prefer service-role; fall back to anon (open grants are still in place until the
// RLS-hardening migration is applied — which waits on the service-role key).
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://community-connector-agent.netlify.app";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / (SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY). Aborting.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const hoursFromNow = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// ── Pull real members from the connector ────────────────────────────────────
async function fetchMembers(limit = 150) {
  const res = await fetch(`${API_BASE}/.netlify/functions/marketplace-members?limit=${limit}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`connector members ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const raw = json.members || json || [];
  // Normalize to the fields we seed with.
  return raw
    .map((m) => {
      const p = m.profile || {};
      return {
        id: m.id,
        name: p.name || null,
        category: p.category || null,
        subcategory: p.subcategory || null,
        memberType: p.memberType || null,
        images: Array.isArray(p.images) ? p.images : p.imageUrl ? [p.imageUrl] : [],
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        neighborhood: p.neighborhood || null,
        city: p.city || "San Francisco",
      };
    })
    .filter((m) => m.id && m.name);
}

const isFood = (m) => /food|beverage|restaurant|bar|cafe|coffee|brew|pub|eatery/i.test(`${m.category} ${m.subcategory} ${m.name}`);
const pick = (arr, n) => arr.slice(0, n);

// ── Seed: live broadcasts (watch parties) ───────────────────────────────────
async function seedBroadcasts(members) {
  await db.from("broadcasts").delete().eq("source", "seed");
  const venues = pick(members.filter(isFood), 10);
  if (!venues.length) return 0;

  // A believable spread: some live right now, some scheduled for tonight.
  const plans = [
    { event_slug: "world-cup", event_label: "FIFA World Cup", whats_on: "Group stage — big screen + sound on", supports_team: "Mexico", live: true },
    { event_slug: "world-cup", event_label: "FIFA World Cup", whats_on: "USA match — pints + tacos", supports_team: "USA", live: true },
    { event_slug: "premier-league", event_label: "Premier League", whats_on: "Saturday fixtures all day", supports_team: null, live: true },
    { event_slug: "nba", event_label: "NBA", whats_on: "Warriors tonight 🏀", supports_team: "Warriors", live: false },
    { event_slug: "champions-league", event_label: "Champions League", whats_on: "Midweek knockout tie", supports_team: null, live: false },
    { event_slug: "world-cup", event_label: "FIFA World Cup", whats_on: "Evening match — reservations open", supports_team: "Argentina", live: false },
    { event_slug: "liga-mx", event_label: "Liga MX", whats_on: "Weekend clásico", supports_team: null, live: true },
    { event_slug: "ufc", event_label: "UFC / MMA", whats_on: "Fight night — main card", supports_team: null, live: false },
  ];

  const rows = venues.slice(0, plans.length).map((v, i) => {
    const plan = plans[i];
    const startsAt = plan.live ? hoursFromNow(-1) : hoursFromNow(5 + i);
    const endsAt = plan.live ? hoursFromNow(3) : hoursFromNow(9 + i);
    return {
      member_id: v.id,
      member_name: v.name,
      event_slug: plan.event_slug,
      event_label: plan.event_label,
      whats_on: plan.whats_on,
      supports_team: plan.supports_team,
      image_urls: v.images.slice(0, 3),
      livestream_url: null,
      starts_at: startsAt,
      ends_at: endsAt,
      latitude: v.latitude,
      longitude: v.longitude,
      neighborhood: v.neighborhood,
      city: v.city,
      active: true,
      source: "seed",
    };
  });
  const { error } = await db.from("broadcasts").insert(rows);
  if (error) throw new Error(`broadcasts insert: ${error.message}`);
  return rows.length;
}

// ── Seed: social feed posts ─────────────────────────────────────────────────
async function seedPosts(members) {
  await db.from("posts").delete().eq("author_id", "seed");
  const captions = [
    "Absolutely worth the hype. Already planning my next visit 🙌",
    "Local gem. This is what the neighborhood is about.",
    "Great vibes, great people, great spot. Support local ❤️",
    "Found my new regular. Tell your friends.",
    "The staff here are the nicest. Come through.",
    "Perfect afternoon. SF small business doing it right.",
    "Can't recommend this place enough. Go now.",
    "Quietly one of the best in the city.",
    "Brought the whole crew — everyone left happy.",
    "This is why I love this neighborhood.",
  ];
  const authors = ["Maya R.", "Community", "Devon", "Priya S.", "Local", "Sam", "Alex T.", "Nina", "Jordan", "Community"];
  const withPhotos = members.filter((m) => m.images.length > 0);
  const chosen = pick(withPhotos, captions.length);

  const rows = chosen.map((m, i) => ({
    author_id: "seed",
    author_name: authors[i % authors.length],
    body: captions[i % captions.length],
    image_urls: m.images.slice(0, 1),
    video_urls: [],
    tagged_member_id: m.id,
    tagged_member_name: m.name,
    tagged_event_id: null,
    tagged_event_title: null,
    livestream_url: null,
    location: m.neighborhood || m.city,
  }));
  if (!rows.length) return 0;
  const { error } = await db.from("posts").insert(rows);
  if (error) throw new Error(`posts insert: ${error.message}`);
  return rows.length;
}

// ── Seed: featured home rails ───────────────────────────────────────────────
async function seedFeatured(members) {
  await db.from("featured_lists").delete().gte("sort_order", 900);
  const bars = pick(members.filter(isFood), 8).map((m) => m.id);
  const variety = pick(members, 10).map((m) => m.id);
  const lists = [];
  if (bars.length) {
    lists.push({
      title: "Where to watch the World Cup in SF",
      subtitle: "Local spots showing every match — with the sound on",
      event_slug: "world-cup",
      supports_team: null,
      member_ids: bars,
      sort_order: 900,
      active: true,
    });
  }
  if (variety.length) {
    lists.push({
      title: "New & noteworthy near you",
      subtitle: "Fresh on WhatsLocal — real local businesses to discover",
      event_slug: "watch-party",
      supports_team: null,
      member_ids: variety,
      sort_order: 901,
      active: true,
    });
  }
  if (!lists.length) return 0;
  const { error } = await db.from("featured_lists").insert(lists);
  if (error) throw new Error(`featured insert: ${error.message}`);
  return lists.length;
}

async function main() {
  console.log(`Fetching real members from ${API_BASE} …`);
  const members = await fetchMembers();
  console.log(`Got ${members.length} real members (${members.filter(isFood).length} food/venue).`);
  if (!members.length) {
    console.error("No members returned — connector unreachable or empty. Aborting seed.");
    process.exit(1);
  }
  const b = await seedBroadcasts(members);
  const p = await seedPosts(members);
  const f = await seedFeatured(members);
  console.log(`Seeded: ${b} broadcasts, ${p} posts, ${f} featured lists.`);
  console.log("Re-run anytime — it replaces its own seed rows (source='seed' / author_id='seed' / sort_order>=900).");
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
