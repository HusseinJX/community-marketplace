import type { Metadata } from "next";
import { ShopperListsClient } from "./ShopperListsClient";

export const metadata: Metadata = {
  title: "My lists",
  description: "Manage your saved local shop lists.",
};

export default function ShopperListsPage() {
  return <ShopperListsClient />;
}
