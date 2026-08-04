import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityChatRoom } from "@/components/community/CommunityChatRoom";
import { DEMO_COMMUNITY_CHATS, getCommunityChat } from "@/lib/demo-community-chats";

export function generateStaticParams() {
  return DEMO_COMMUNITY_CHATS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const chat = getCommunityChat((await params).id);
  if (!chat) return { title: "Community chat" };
  return {
    title: `${chat.name} — community chat`,
    description: chat.blurb,
    // A room you can only enter in person has nothing to offer a crawler, and
    // listing them would undo the "you have to find it" mechanic.
    robots: { index: false, follow: false },
  };
}

export default async function CommunityChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const chat = getCommunityChat((await params).id);
  if (!chat) notFound();
  return <CommunityChatRoom chat={chat} />;
}
