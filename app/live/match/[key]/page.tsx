import type { Metadata } from "next";
import { MatchDetail } from "@/components/live/MatchDetail";

export const metadata: Metadata = {
  title: "Where to watch",
  description: "Every place showing this game right now — with a map.",
};

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <MatchDetail matchKey={key} />;
}
