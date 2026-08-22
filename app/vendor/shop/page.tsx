import { auth } from "@clerk/nextjs/server";
import { Package, Plug, ShoppingCart } from "lucide-react";
import { getOrdersByMember, getVendorProfile } from "@/lib/vendor-connect";
import { isAdmin } from "@/lib/admin";
import { demoMemberId, isDemoActive } from "@/lib/demo-server";
import { HubTile } from "@/components/vendor/HubTile";

export const metadata = { title: "Shop" };

// The Shop button on the dashboard opens THIS, not the product list.
//
// Selling is three things — what you sell, what people bought, and the plumbing
// that makes both work — and only one of them is the catalogue. Going straight
// to products made orders and payouts feel like somewhere else entirely; a
// vendor looking for "where did my money go" had to know to look under a
// heading on the dashboard.
export default async function VendorShopPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { userId } = await auth();
  const { memberId: requested } = await searchParams;
  const profile = userId ? await getVendorProfile(userId) : null;
  const admin = isAdmin(userId);
  const memberId =
    (admin && requested) || profile?.member_id || (!userId && (await isDemoActive()) ? await demoMemberId() : null);

  // The one number worth reading before you tap anything. Orders is the tile a
  // vendor opens hoping for a change, so the tile answers first.
  let orderCount = 0;
  if (memberId) {
    try {
      orderCount = (await getOrdersByMember(memberId)).length;
    } catch {
      /* the tile just says nothing rather than failing the page */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Shop</h1>
        <p className="mt-1 text-sm text-stone-500">
          What you sell, what people bought, and where it all connects.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HubTile href="/vendor/products" Icon={Package} label="Products" desc="Your shop catalog" />
        <HubTile
          href="/vendor/orders"
          Icon={ShoppingCart}
          label="Orders"
          desc={orderCount > 0 ? `${orderCount} to date` : "No orders yet"}
        />
        {/* One home for the external hookups: shop catalog, delivery, and the
            payout bank account. */}
        <HubTile
          href="/vendor/integrations"
          Icon={Plug}
          label="Integrations"
          desc="Shop, delivery & bank payouts"
        />
      </div>
    </div>
  );
}
