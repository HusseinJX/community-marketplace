import Link from "next/link";
import { Sparkles, ChevronRight, MessageSquare } from "lucide-react";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-stone-900">Messages</h1>

      {/* Pinned AI concierge conversation — same kind of chat people have with us
          over SMS, but in-app. */}
      <Link
        href="/messages/assistant"
        className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 transition hover:border-indigo-200"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
          <Sparkles className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900">WhatsLocal Assistant</span>
            <span className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              AI
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone-500">
            Ask me to find local spots, makers, events, or community orgs.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-stone-400" />
      </Link>

      {/* Direct messages with businesses + orgs — not built yet. */}
      <div className="mt-8 flex flex-col items-center px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <MessageSquare className="h-5 w-5 text-stone-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-stone-700">Your conversations</p>
        <p className="mt-1 max-w-xs text-sm text-stone-500">
          Direct messages with local businesses and community orgs are coming soon.
        </p>
      </div>
    </div>
  );
}
