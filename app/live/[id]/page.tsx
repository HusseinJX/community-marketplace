import type { Metadata } from "next";
import { BroadcastDetail } from "@/components/live/BroadcastDetail";

export const metadata: Metadata = {
  title: "Live at this venue",
  description: "See what's showing right now — the vibe, the crowd, the livestream.",
};

export const dynamic = "force-dynamic";

export default async function LiveBroadcastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BroadcastDetail id={id} />;
}
