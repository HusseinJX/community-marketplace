"use client";

import { useState } from "react";
import { Check, Loader2, Rocket, Store, Search, Users } from "lucide-react";
import type { Plan } from "@/lib/entitlements";
import { useIsNativeApp } from "@/lib/native";

type SelfServePlan = "member" | "pro";

// ⚠️ Every line below is a PROMISE ATTACHED TO A LIVE PRICE. Only list what
// `lib/entitlements.ts` actually grants for that plan — check `FREE_CAN` /
// `MEMBER_CAN` / `PRO_CAN` before adding a bullet, and check the feature exists
// at all before adding it to any tier.
//
// This drifted badly and was corrected 2026-07-17. It had been selling:
//   • "AI customer-service agent" on Member ($10) — `textAssistant` is PRO_CAN
//     only, so payers were refused the thing the tagline ("Get the agent")
//     promised.
//   • "Analytics & insights" on Pro — `analytics` is a string in the Capability
//     union with no page, route, or gate call behind it.
//   • "AI voice agent with booking" on Pro — no booking/reservations system
//     exists (no tables, routes, or components).
// It also described Member as "Receive collaboration invites" (that's free —
// `networkReceive` is in FREE_CAN) while omitting what $10 actually buys:
// SENDING invites and HOSTING events.
//
// Labels/taglines here duplicate `PLAN_META` in lib/entitlements.ts, which is
// how they drifted out of sync. If this drifts again, derive them from PLAN_META
// instead of retyping them.
const TIERS: {
  plan: Plan;
  label: string;
  price: string;
  cadence?: string;
  tagline: string;
  icon: typeof Store;
  highlight?: boolean;
  features: string[];
  cta: "current" | "checkout" | "contact" | "free";
}[] = [
  {
    plan: "free",
    label: "Participate",
    price: "$0",
    tagline: "Start here.",
    icon: Search,
    cta: "free",
    features: [
      // FREE_CAN: claimedProfile, posts, discovery, networkReceive.
      // The claimed profile and event invites ARE free — the old copy omitted
      // both and instead promised "the AI agent" one tier up, which was wrong.
      "Claimed profile",
      "Get invited to events",
      "Post & be found",
      "Community support & resources",
    ],
  },
  {
    plan: "member",
    label: "Organizer",
    price: "$10",
    cadence: "/month",
    tagline: "Send invites & host events.",
    icon: Users,
    cta: "checkout",
    features: [
      // MEMBER_CAN adds: networkInitiate, organizeEvents, captureLeads, automations.
      // NOT textAssistant — the agent is Pro.
      "Everything in Free",
      "Send collaboration invites",
      "Host & organize events",
      "Reach the network — matching & lineups",
      "Capture leads & RSVPs",
      "Automations & follow-ups (SMS/email)",
    ],
  },
  {
    plan: "pro",
    label: "Pro",
    price: "$30",
    cadence: "/month",
    tagline: "Sell on the network.",
    icon: Rocket,
    highlight: true,
    cta: "checkout",
    features: [
      // PRO_CAN adds: textAssistant, voiceAssistant, commerce.
      // (Send invites / organize events moved out — they're Member, already
      // covered by "Everything in Organizer".)
      "Everything in Organizer",
      "AI customer-service agent",
      "Powerful AI voice agent",
      // "Sell & deliver" on the promo art: selling is real, DELIVERY IS NOT
      // AVAILABLE — the platform has no Uber Direct credentials, so the vendor
      // toggle stays hidden (uberConfigured()). Say "sell" until it's real.
      "Sell online — take payments, 5% per sale",
      // Only Shopify + Square are wired (lib/composio.ts TOOL_SLUGS /
      // AUTH_CONFIG_ENV). The promo art also lists Calendar + CRM: neither
      // exists — no calendar/booking system, no CRM toolkit, no auth configs.
      "Connect your POS — Shopify or Square",
      "Capture leads, RSVPs & inquiries",
    ],
  },
  {
    plan: "enterprise",
    label: "Organizations",
    price: "Contact sales",
    tagline: "Power collective impact.",
    icon: Store,
    cta: "contact",
    features: [
      "Custom partnership setup",
      "Support for larger events & activations",
      "Multi-vendor / multi-artist coordination",
      "Custom onboarding & rollout help",
    ],
  },
];

export function BillingPlans({
  currentPlan,
  memberId,
}: {
  currentPlan: Plan;
  memberId: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const native = useIsNativeApp();

  async function upgrade(plan: SelfServePlan) {
    setError(null);
    setBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, memberId }),
      });
      const d = await res.json();
      if (res.ok && d.url) {
        window.location.href = d.url;
        return;
      }
      setError(
        d.error === "plan_unavailable"
          ? "This plan isn't set up for checkout yet."
          : d.error === "no_member"
          ? "Link your business profile first."
          : "Couldn't start checkout. Please try again."
      );
    } catch {
      setError("Couldn't start checkout. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    setError(null);
    setBusy("manage");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const d = await res.json();
      if (res.ok && d.url) {
        window.location.href = d.url;
        return;
      }
      setError("Couldn't open billing. Please try again.");
    } catch {
      setError("Couldn't open billing. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const isPaid = currentPlan === "member" || currentPlan === "pro" || currentPlan === "enterprise";

  // Apple 3.1.1: the native app must not sell or price digital subscriptions,
  // nor route to web checkout. Show current plan only — no tiers, no prices,
  // no upgrade/manage buttons. Plans stay fully purchasable on the web.
  if (native) {
    const label = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
        <p className="text-sm text-stone-500">Your current plan</p>
        <p className="mt-1 text-lg font-semibold text-stone-900">{label}</p>
        <p className="mt-3 text-sm text-stone-500">
          You have everything your plan includes. Plan changes aren&apos;t available in the app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-2 text-center text-sm text-rose-700">{error}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => {
          const Icon = t.icon;
          const isCurrent = t.plan === currentPlan;
          return (
            <div
              key={t.plan}
              className={
                "relative flex flex-col rounded-2xl border p-4 " +
                (t.highlight
                  ? "border-violet-400 bg-white shadow-lg ring-1 ring-violet-200"
                  : "border-stone-200 bg-white")
              }
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  ★ Most powerful
                </span>
              )}
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={
                    "inline-flex h-9 w-9 items-center justify-center rounded-lg " +
                    (t.highlight ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-700")
                  }
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-stone-900">{t.label}</span>
              </div>

              <div className="mb-1">
                <span className="text-xl font-bold text-stone-900">{t.price}</span>
                {t.cadence && <span className="text-sm text-stone-500">{t.cadence}</span>}
              </div>
              <p className="mb-4 text-xs font-medium text-violet-600">{t.tagline}</p>

              <ul className="mb-5 flex-1 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-stone-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isCurrent ? (
                <button
                  disabled
                  className="rounded-full bg-stone-100 px-3.5 py-2 text-[13px] font-semibold text-stone-500"
                >
                  Current plan
                </button>
              ) : t.cta === "checkout" ? (
                <button
                  onClick={() => upgrade(t.plan as SelfServePlan)}
                  disabled={busy === t.plan}
                  className={
                    "inline-flex items-center justify-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white transition disabled:opacity-60 " +
                    (t.highlight ? "bg-violet-600 hover:bg-violet-700" : "bg-stone-900 hover:bg-stone-800")
                  }
                >
                  {busy === t.plan && <Loader2 className="h-4 w-4 animate-spin" />}
                  {currentPlan === "member" && t.plan === "pro" ? "Upgrade to Pro" : `Choose ${t.label}`}
                </button>
              ) : t.cta === "contact" ? (
                <a
                  href="mailto:hello@whatslocal.ai?subject=WhatsLocal%20Organizations%20plan"
                  className="inline-flex items-center justify-center rounded-full border border-stone-300 px-3.5 py-2 text-[13px] font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Contact sales
                </a>
              ) : (
                <span className="rounded-full px-4 py-2 text-center text-sm text-stone-400">
                  Default listing
                </span>
              )}
            </div>
          );
        })}
      </div>

      {isPaid && (
        <div className="text-center">
          <button
            onClick={manage}
            disabled={busy === "manage"}
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            {busy === "manage" && <Loader2 className="h-4 w-4 animate-spin" />}
            Manage billing & invoices →
          </button>
        </div>
      )}
    </div>
  );
}
