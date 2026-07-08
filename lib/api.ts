import type {
  MembersResponse,
  MemberResponse,
  EventsResponse,
  MemberType,
  MemberProfile,
  Member,
  SearchResponse,
  MatchCandidate,
  LineupSuggestion,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://community-connector-agent.netlify.app";

function fnUrl(name: string, params?: Record<string, string | undefined>) {
  const url = new URL(`/.netlify/functions/${name}`, API_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

// Fail fast: if the connector is slow or erroring (e.g. its Firestore is over
// quota and takes ~8s to 500), abort after a few seconds so callers fall back
// to cached/demo data quickly instead of blocking every navigation.
const CONNECTOR_TIMEOUT_MS = 4500;

async function getJson<T>(url: string): Promise<T> {
  // Long server-side cache window; pages can revalidate on-demand.
  const res = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(CONNECTOR_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface ListMembersParams {
  type?: MemberType | "all";
  city?: string;
  category?: string;
  subcategory?: string;
  limit?: number;
  cursor?: string;
}

export async function listMembers(params: ListMembersParams = {}): Promise<MembersResponse> {
  const type = params.type && params.type !== "all" ? params.type : undefined;
  return getJson<MembersResponse>(
    fnUrl("marketplace-members", {
      type,
      city: params.city,
      category: params.category,
      subcategory: params.subcategory,
      limit: params.limit ? String(params.limit) : undefined,
      cursor: params.cursor,
    })
  );
}

export async function getMember(id: string): Promise<MemberResponse> {
  return getJson<MemberResponse>(fnUrl("marketplace-member", { id }));
}

// Create a brand-new member in the connector (Firestore + embeddings). Server-only
// — uses the admin token. Used by the onboarding flows (manual interview + QR chat).
export async function createMember(
  profile: Partial<MemberProfile> & { name: string },
  opts?: { source?: string }
): Promise<Member> {
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  const res = await fetch(fnUrl("marketplace-create-member"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profileUpdate: profile, source: opts?.source ?? "marketplace" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`create-member failed: ${res.status}`);
  const d = await res.json();
  return d.member as Member;
}

// Patch fields on an existing member's profile (connector patch-member). Server-only.
export async function patchMember(id: string, fields: Partial<MemberProfile>): Promise<void> {
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  const res = await fetch(fnUrl("patch-member"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, fields }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`patch-member failed: ${res.status}`);
}

// Onboard a new member by running the connector's own profiling brain over a full
// conversation transcript (same engine as SMS/web onboarding). Server-only.
export async function onboardFromMessages(
  messages: { role: "user" | "assistant"; content: string }[],
  opts?: { source?: string; memberId?: string }
): Promise<Member> {
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  const res = await fetch(fnUrl("marketplace-onboard"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    // memberId (optional) → enrich that existing member in place instead of
    // creating a new one (used by the /join interview, which already made it).
    body: JSON.stringify({ messages, source: opts?.source ?? "qr_onboard", memberId: opts?.memberId }),
    cache: "no-store",
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `onboard failed: ${res.status}`);
  }
  const d = await res.json();
  return d.member as Member;
}

// Smart natural-language search.
// "buzz cut under $15 in Chinatown with a TV", "family-owned jewelry maker",
// "historic Italian restaurant in North Beach" — all valid. The backend GPT-
// parses intent, applies structured filters at the Pinecone metadata level,
// and returns each result with a matchedOn[] array of breadcrumbs.
export async function searchMembers(
  query: string,
  opts: { limit?: number } = {}
): Promise<SearchResponse> {
  return getJson<SearchResponse>(
    fnUrl("marketplace-search", {
      q: query,
      limit: opts.limit ? String(opts.limit) : undefined,
    })
  );
}

export async function listEvents(params: { memberId?: string; limit?: number } = {}): Promise<EventsResponse> {
  return getJson<EventsResponse>(
    fnUrl("marketplace-events", {
      memberId: params.memberId,
      limit: params.limit ? String(params.limit) : undefined,
    })
  );
}

// ── Semantic matching (connector convener/complementary/similar) ─────────────
// These hit ADMIN_TOKEN-gated connector functions, so they are SERVER-ONLY and
// must be reached through the /api/vendor/match proxy (never the client). Each
// normalizes the connector's varied response shapes into MatchCandidate[].

// Matching compute can be slow (multiple GPT + Pinecone + Firestore hydrate),
// so these get a longer leash than the 4.5s browse timeout.
const MATCH_TIMEOUT_MS = 30000;

async function postAdmin<T>(name: string, body: unknown): Promise<T> {
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  const res = await fetch(fnUrl(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(MATCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// The connector uses inconsistent key names across endpoints
// (id/memberId, name/memberName/profile.name). Normalize defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCandidate(c: any, extra?: Partial<MatchCandidate>): MatchCandidate {
  const profile = c.profile as MemberProfile | undefined;
  return {
    id: String(c.id ?? c.memberId ?? ""),
    // Left empty when the connector didn't hydrate a name; callers drop these
    // (an unnamed candidate can't be meaningfully shown or invited).
    name: String(c.name ?? c.memberName ?? profile?.name ?? ""),
    memberType: c.memberType ?? profile?.memberType,
    city: c.city ?? profile?.city,
    neighborhood: c.neighborhood ?? profile?.neighborhood,
    category: c.category ?? profile?.category,
    score: typeof c.score === "number" ? c.score : c.similarityScore,
    reasons: Array.isArray(c.matchedOn)
      ? c.matchedOn
      : Array.isArray(c.fit)
        ? c.fit
        : [],
    offers: Array.isArray(c.offers) ? c.offers : undefined,
    profile,
    ...extra,
  };
}

// Natural-language semantic search, normalized to MatchCandidate[]. Uses the
// public marketplace-search but with the long MATCH timeout — the GPT intent
// parse routinely exceeds the 4.5s browse budget that searchMembers() uses.
export async function searchMatches(query: string, limit = 8): Promise<MatchCandidate[]> {
  const res = await fetch(fnUrl("marketplace-search", { q: query, limit: String(limit) }), {
    cache: "no-store",
    signal: AbortSignal.timeout(MATCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`marketplace-search failed: ${res.status}`);
  const d = (await res.json()) as SearchResponse;
  return (d.results ?? [])
    .map((r) =>
      toCandidate({
        id: r.id,
        name: r.profile?.name,
        memberType: r.profile?.memberType,
        city: r.profile?.city,
        neighborhood: r.profile?.neighborhood,
        category: r.profile?.category,
        score: r.score,
        matchedOn: r.matchedOn,
        profile: r.profile,
      }),
    )
    .filter((c) => c.id && c.name);
}

// Vector-to-vector: members most similar to an existing one (connector matches.js).
export async function similarMembers(memberId: string, limit = 8): Promise<MatchCandidate[]> {
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  const res = await fetch(fnUrl("matches", { memberId, topK: String(limit) }), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(MATCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`matches failed: ${res.status}`);
  const d = await res.json();
  return (d.matches ?? []).map((m: unknown) => toCandidate(m)).filter((c: MatchCandidate) => c.id && c.name);
}

// Need/theme → people: treats a free-text objective as a "need" and finds
// members who offer it (connector convener-search objective mode).
export async function matchObjective(objective: string, limit = 8): Promise<MatchCandidate[]> {
  const d = await postAdmin<{ candidates?: unknown[] }>("convener-search", { objective, limit });
  return (d.candidates ?? []).map((c) => toCandidate(c)).filter((c) => c.id && c.name);
}

// Complementary "for you": members who offer what this member needs (and vice
// versa) — the bidirectional core primitive (connector convener-search member mode).
export async function complementaryFor(memberId: string, limit = 8): Promise<MatchCandidate[]> {
  const d = await postAdmin<{ candidates?: unknown[] }>("convener-search", { memberId, limit });
  return (d.candidates ?? []).map((c) => toCandidate(c)).filter((c) => c.id && c.name);
}

// Person-to-event: invent a concrete event from a hint (the organizer's real
// event title/desc/city) and return per-role candidate fills (connector convener).
export async function suggestLineup(hint: string): Promise<LineupSuggestion> {
  const d = await postAdmin<{ draft?: Record<string, unknown> }>("convener", {
    mode: "invent-event",
    hint,
  });
  const draft = d.draft ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleCandidates = (draft.roleCandidates as any[]) ?? [];
  return {
    title: String(draft.title ?? "Proposed event"),
    description: String(draft.description ?? ""),
    roles: roleCandidates.map((r) => ({
      role: String(r.role ?? "Role"),
      type: r.type ? String(r.type) : undefined,
      candidates: (r.candidates ?? [])
        .map((c: unknown) => toCandidate(c, { role: String(r.role ?? "") }))
        .filter((c: MatchCandidate) => c.id && c.name),
    })),
  };
}
