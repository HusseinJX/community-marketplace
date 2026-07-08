import type { Metadata } from "next";
import { JoinFlow } from "./JoinFlow";

export const metadata: Metadata = {
  title: "Join WhatsLocal",
  description: "Set up your business, org, or artist page on WhatsLocal — verify with your phone in the browser.",
};

// Self-serve "fresh join" — the rep-flow self-onboarding sequence, all in the browser.
export default function JoinPage() {
  return <JoinFlow />;
}
