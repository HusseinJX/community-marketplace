import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { AssistantChat } from "@/components/messages/AssistantChat";

export const metadata = { title: "WhatsLocal Assistant" };

export default function AssistantPage() {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col"
      // Fill the space between the top nav and the bottom nav so the input pins
      // just above the bottom navbar (no page scroll, no footer below).
      style={{ height: "calc(100dvh - 3.5rem - env(safe-area-inset-top) - 3.25rem - env(safe-area-inset-bottom))" }}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-stone-100 bg-white px-4 py-3">
        <Link href="/messages" className="rounded-full p-1 text-stone-500 hover:bg-stone-100" aria-label="Back">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">WhatsLocal Assistant</p>
          <p className="truncate text-[11px] text-emerald-600">● Always on</p>
        </div>
      </div>
      <AssistantChat />
    </div>
  );
}
