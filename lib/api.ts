import type {
  MembersResponse,
  MemberResponse,
  EventsResponse,
  MemberType,
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

async function getJson<T>(url: string): Promise<T> {
  // Long server-side cache window; pages can revalidate via on-demand.
  const res = await fetch(url, { next: { revalidate: 300 } });
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

export async function listEvents(params: { memberId?: string; limit?: number } = {}): Promise<EventsResponse> {
  return getJson<EventsResponse>(
    fnUrl("marketplace-events", {
      memberId: params.memberId,
      limit: params.limit ? String(params.limit) : undefined,
    })
  );
}
