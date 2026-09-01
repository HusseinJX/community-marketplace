import type { Metadata } from "next";
import { MembershipsMarketplace } from "./MembershipsMarketplace";

export const metadata: Metadata = {
  title: "All memberships",
  description: "Browse local memberships from nearby businesses, studios, gyms, and classes.",
};

export default function MembershipsPage() {
  return <MembershipsMarketplace />;
}
