"use client";

import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { ArrowRight, MessagesSquare } from "lucide-react";
import { useSupportUnread } from "@/lib/data-hooks";

/**
 * "Chat with our team" — on top of every home tab, for signed-in people only.
 *
 * Signed-out it renders NOTHING rather than a sign-in prompt: an invitation to
 * talk to us that turns into an auth wall is a worse first impression than no
 * invitation, and there would be nobody to reply to anyway.
 *
 * The red badge is the only part that polls (one integer, see
 * useSupportUnread). It is the reason this lives on the home tabs at all: a
 * reply nobody sees is a conversation we started and dropped.
 */
export function SupportCard() {
  return (
    <Show when="signed-in">
      <SupportCardInner />
    </Show>
  );
}

function SupportCardInner() {
  const { unread } = useSupportUnread();

  return (
    <Link
      href="/support/chat"
      className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300 hover:shadow-[var(--shadow-lift)]"
    >
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white">
        <MessagesSquare className="h-4 w-4" />
        {unread > 0 && (
          <span
            aria-label={`${unread} unread ${unread === 1 ? "reply" : "replies"}`}
            className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-900">
          {unread > 0 ? "Our team replied" : "Chat with our team"}
        </span>
        <span className="block truncate text-[13px] text-stone-500">
          {unread > 0
            ? "You have a new message waiting."
            : "Get help, or tell us what would make this better."}
        </span>
      </span>

      <ArrowRight className="h-4 w-4 shrink-0 text-stone-400 transition group-hover:text-stone-900" />
    </Link>
  );
}
