import { TasteTuner } from "@/components/shopper/TasteTuner";

export const metadata = { title: "Personalization settings" };

// Its own screen, reached from Quick access, rather than sitting expanded on
// /shopper. It is a settings panel — a text box, chips and a chat — and it was
// the tallest thing between the shopper's own stuff and the community sections
// below it, for a control most people set once and never touch again.
//
// Deliberately NOT gated on being signed in: the taste profile is keyed on the
// browser until there is an account to move it to, so a signed-out visitor can
// use this exactly as a signed-in one does (see lib/taste-id.ts).
export default function PersonalizationPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-stone-900">
        Personalization settings
      </h1>
      <p className="mt-1.5 text-sm text-stone-500">
        What we use to rank the events feed. Only you can see this, and you can change or delete
        it any time.
      </p>

      <div className="mt-6">
        {/* The page title already says what this is, so the component's own
            "What you're into" heading would be a second header on one screen. */}
        <TasteTuner showLabel={false} />
      </div>
    </div>
  );
}
