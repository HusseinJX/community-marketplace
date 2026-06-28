import type { Metadata } from "next";
import { FeaturedDetail } from "@/components/live/FeaturedDetail";

export const metadata: Metadata = {
  title: "Where to watch near you",
  description: "Find the local venues showing the game right now — the vibe, the crowd, the big screen.",
};

export const dynamic = "force-dynamic";

export default async function FeaturedListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FeaturedDetail id={id} />;
}
