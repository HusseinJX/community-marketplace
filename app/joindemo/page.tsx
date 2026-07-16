import type { Metadata } from "next";
import { JoinFlow } from "../join/JoinFlow";
import { JoinDemoGate } from "@/components/join/JoinDemoGate";
import { isJoinDemoActive } from "@/lib/joindemo";

export const metadata: Metadata = {
  title: "Join demo",
  robots: { index: false, follow: false },
};

// Password-gated, repeatable, side-effect-free walkthrough of the /join
// onboarding. Reuses the exact JoinFlow component with `demo` on. Completely
// separate from /join — the real flow never renders in demo mode.
export const dynamic = "force-dynamic";

export default async function JoinDemoPage() {
  const unlocked = await isJoinDemoActive();
  if (!unlocked) return <JoinDemoGate />;
  return <JoinFlow demo />;
}
