import { NextResponse } from "next/server";
import { listMembers } from "@/lib/api";

// Server-side directory proxy. The home "Who's local" rail and /explore used to
// call listMembers() directly from the browser, which (a) exposed the connector
// to clients and (b) got no benefit from the `next: { revalidate: 300 }` cache
// in lib/api.ts (that hint is ignored in a client fetch). Routing through this
// handler runs the connector call on the server where the fetch cache applies,
// and both surfaces share one key (`/api/directory`) so SWR dedupes them.
export async function GET() {
  try {
    const { members } = await listMembers({ limit: 100 });
    return NextResponse.json({ members: members ?? [] });
  } catch {
    // Connector down / slow — return empty so callers keep their prior/demo data.
    return NextResponse.json({ members: [] });
  }
}
