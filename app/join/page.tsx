import { Suspense } from "react";
import type { Metadata } from "next";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "Join WhatsLocal",
  description: "Set up your business, org, or artist page on WhatsLocal — sign in with Google or Apple, all in the browser.",
};

// Self-serve "fresh join" — the rep-flow self-onboarding sequence, all in the browser.
// JoinFlow reads ?claim= / ?claimed= via useSearchParams, which needs a Suspense
// boundary to prerender. Without it the whole route opts into dynamic rendering.
export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinFlow />
    </Suspense>
  );
}
