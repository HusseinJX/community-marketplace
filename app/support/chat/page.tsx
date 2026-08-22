import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import { SupportChat } from "@/components/support/SupportChat";
import { ViewportLock } from "@/components/layout/ViewportLock";

export const metadata = { title: "Chat with our team" };

// The live conversation. /support itself stays what it was — the public help
// page with the FAQ and the support address, which works signed-out and is
// linked from the footer.
//
// Signed-in only, checked on the SERVER rather than by hiding the card that
// links here: a URL is typeable and bookmarkable, and there is nothing to show
// someone we cannot reply to.
export const dynamic = "force-dynamic";

export default async function SupportChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/support");

  return (
    // Fills whatever the app chrome leaves, and does not scroll: ViewportLock
    // pins the body to the viewport, <main> is already flex-1, and this column
    // takes the remainder. No calc naming the navs — see the component.
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ViewportLock />
      <div className="mx-auto w-full max-w-2xl shrink-0 px-4 pt-4 md:px-8">
        {/* Home, not /support. Almost everyone arrives from the card on the home
            tabs, and sending them to the help page instead of back where they
            were makes the back link a second navigation rather than a way out. */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
          Chat with our team
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Support, and anything that would make this better. We usually reply within a day.
        </p>
      </div>

      <div className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col px-4 md:px-8">
        <SupportChat />
      </div>
    </div>
  );
}
