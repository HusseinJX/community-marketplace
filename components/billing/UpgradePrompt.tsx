"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

// Inline "this needs a paid plan" banner shown when an action returns 402
// upgrade_required. `requires` names the lowest plan that unlocks it.
export function UpgradePrompt({
  requires = "pro",
  message,
}: {
  requires?: "member" | "pro";
  message?: string;
}) {
  const planLabel = requires === "member" ? "Member" : "Pro";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <Sparkles className="h-4 w-4 shrink-0 text-violet-600" />
      <span className="min-w-0 flex-1">
        {message ?? `This is a ${planLabel} feature. Upgrade to unlock it.`}
      </span>
      <Link
        href="/vendor/billing"
        className="shrink-0 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
      >
        Upgrade to {planLabel}
      </Link>
    </div>
  );
}

// Small helper: given a fetch Response + parsed body, return upgrade info if it
// was a 402 upgrade_required, else null.
export function upgradeFrom(
  status: number,
  body: { error?: string; requires?: "member" | "pro" } | null | undefined
): { requires: "member" | "pro" } | null {
  if (status === 402 && body?.error === "upgrade_required") {
    return { requires: body.requires ?? "pro" };
  }
  return null;
}
