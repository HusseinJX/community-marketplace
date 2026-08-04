import { MessageSquare } from "lucide-react";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-stone-900">Messages</h1>

      {/* The AI concierge moved out of Messages — it's now the floating assistant
          button (AssistantLauncher). This tab is DMs only. */}

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
