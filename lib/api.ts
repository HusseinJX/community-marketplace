import type {
  MembersResponse,
  MemberResponse,
  EventsResponse,
  MemberType,
  MemberProfile,
  Member,
  SearchResponse,
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
  opts?: { source?: string }
): Promise<Member> {
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  const res = await fetch(fnUrl("marketplace-onboard"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, source: opts?.source ?? "qr_onboard" }),
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
