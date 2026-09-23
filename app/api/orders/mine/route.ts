import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and a Supabase key are required");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Shopper purchase history. Scoped by the signed-in user's verified email
// addresses; never exposes delivery address, payment intent, or vendor payout.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ orders: [] }, { status: 401 });

  const user = await currentUser();
  const emails = [
    ...new Set(
      (user?.emailAddresses ?? [])
        .filter((addr) => addr.verification?.status === "verified")
        .map((addr) => addr.emailAddress.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (!emails.length) return NextResponse.json({ orders: [] });

  const { data, error } = await db()
    .from("orders")
    .select(
      "id, order_number, member_id, buyer_email, status, items, subtotal_cents, discount_cents, member_discount_percent, fulfillment_type, delivery_provider, delivery_fee_charged_cents, event_id, created_at, updated_at",
    )
    .in("buyer_email", emails)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message || "Could not load orders" }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}
