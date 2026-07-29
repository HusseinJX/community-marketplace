import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getVendorProfile } from "@/lib/vendor-connect";
import { ShopperClient } from "./ShopperClient";

export const dynamic = "force-dynamic";

// The Profile tab. A signed-in vendor (a Clerk user linked to a member in
// vendor_profiles) is sent to their business dashboard instead of the shopper
// space — done server-side so there's no flash of the wrong page. Shoppers and
// signed-out visitors get the shopper space (ShopperClient).
export default async function ShopperPage() {
  const { userId } = await auth();
  if (userId) {
    const vendor = await getVendorProfile(userId).catch(() => null);
    if (vendor?.member_id) redirect("/vendor");
  }
  return <ShopperClient />;
}
