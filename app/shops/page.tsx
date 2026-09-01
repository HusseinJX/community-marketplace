import type { Metadata } from "next";
import { ShopsClient } from "./ShopsClient";

export const metadata: Metadata = {
  title: "Browse shops",
  description: "Browse local shops and businesses on WhatsLocal AI.",
};

export default function ShopsPage() {
  return <ShopsClient />;
}
