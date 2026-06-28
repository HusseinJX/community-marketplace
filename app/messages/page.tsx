import { Send } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
        <Send className="h-6 w-6 text-stone-400" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-stone-900">Messages</h1>
      <p className="mt-1 text-sm text-stone-500">
        Chat with local businesses and community orgs. Coming soon.
      </p>
    </div>
  );
}
