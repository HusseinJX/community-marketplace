import type { Metadata } from "next";
import { Marketplace } from "@/components/shop/Marketplace";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse WhatsLocal AI merchandise and local goods.",
};

// The grid itself lives in components/shop/Marketplace so the home Products tab
// can render exactly the same thing without navigating away.
export default function ShopPage() {
  return <Marketplace />;
}
