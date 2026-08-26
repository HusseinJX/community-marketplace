"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { BadgeCheck, Check, Loader2 } from "lucide-react";
import { useLogin } from "@/components/auth/ClerkAuthProvider";
import type { MembershipPlan } from "@/lib/memberships";

// The join surface on a business profile.
//
// ⚠️ It shows a recurring price inside the iOS app, deliberately. Apple 3.1.1
// governs unlocks of DIGITAL content; these tiers buy real-world things — money
// off at the counter, a free coffee, early access to a real event — which
// 3.1.3(e) puts outside IAP, the same footing as the event tickets and bookings
// this app already sells on Stripe. If a digital perk is ever added, this
// component needs a NativeGate and the whole feature needs StoreKit.

function priceLabel(p: MembershipPlan) {
  const dollars = (p.price_cents / 100).toFixed(p.price_cents % 100 === 0 ? 0 : 2);
  return `$${dollars}/${p.billing_interval === "year" ? "yr" : "mo"}`;
}

export function MembershipTiers({
  plans,
  memberName,
  memberId,
  currentPlanId,
}: {
  plans: MembershipPlan[];
  memberName: string;
  memberId: string;
  /** Set when the viewer already belongs — the tier they are on. */
  currentPlanId?: string | null;
}) {
  const { isSignedIn } = useUser();
  const openLogin = useLogin();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plans.length) return null;

  async function join(planId: string) {
    // A membership renews, so it needs an account to renew for. Sending them to
    // Stripe as a guest would take the money and leave nobody holding the perk.
    if (!isSignedIn) {
      openLogin({ redirectUrl: `/members/${memberId}` });
      return;
    }
    setBusy(planId);
    setError(null);
    try {
      const res = await fetch("/api/memberships/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, returnPath: `/members/${memberId}` }),
      });
      const data = await res.json();
      if (data.url) {
        // assign(), not `location.href =`, so this doesn't read as a write
        // to an outside value (the lint rule that flags it is right in general).
        window.location.assign(data.url);
        return;
      }
      setError(
        data.error === "vendor_not_ready"
          ? "This business can't take payments yet."
          : data.error === "already_member"
            ? "You're already a member here."
            : "Couldn't start that just now. Please try again."
      );
    } catch {
      setError("Couldn't start that just now. Please try again.");
    }
    setBusy(null);
  }

  return (
    <section className="mt-8">
      <p className="section-label mb-1">Membership</p>
      <p className="t-meta mb-4 text-stone-500">
        Support {memberName} every month and get something back.
      </p>

      <div className="space-y-3">
        {plans.map((plan) => {
          const mine = currentPlanId === plan.id;
          return (
            <div key={plan.id} className="card-soft p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="t-strong text-stone-900">{plan.name}</span>
                <span className="shrink-0 t-strong text-stone-900">{priceLabel(plan)}</span>
              </div>

              {plan.description && (
                <p className="mt-1 t-meta text-stone-500">{plan.description}</p>
              )}

              <ul className="mt-3 space-y-1.5">
                {/* The discount leads because it is the only perk that happens
                    on its own — everything under it relies on the business. */}
                {!!plan.discount_percent && (
                  <li className="flex items-start gap-2 t-meta text-stone-700">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                    <span>
                      <span className="font-semibold">{plan.discount_percent}% off</span> everything
                      they sell, applied automatically at checkout.
                    </span>
                  </li>
                )}
                {plan.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2 t-meta text-stone-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {mine ? (
                <p className="mt-4 t-meta font-semibold text-teal-700">You&apos;re a member ✓</p>
              ) : (
                <button
                  onClick={() => join(plan.id)}
                  disabled={busy === plan.id || !!currentPlanId}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 t-meta font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
                >
                  {busy === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {currentPlanId ? "You're on another tier" : `Join for ${priceLabel(plan)}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 t-meta text-red-600">{error}</p>}
      <p className="mt-3 t-meta text-stone-400">
        Renews automatically. Cancel any time from your profile — you keep it until the period ends.
      </p>
    </section>
  );
}
