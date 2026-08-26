import type { Metadata } from "next";
import { MembershipsClient } from "./MembershipsClient";

export const metadata: Metadata = {
  title: "Your memberships",
  robots: { index: false, follow: false },
};

// The shopper's side of a vendor membership. The vendor's side is
// /vendor/memberships — same rows, opposite direction.
export default function ShopperMembershipsPage() {
  return <MembershipsClient />;
}
