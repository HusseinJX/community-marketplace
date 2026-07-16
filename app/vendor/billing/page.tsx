import { auth } from "@clerk/nextjs/server";
import { resolveActor, isAdmin } from "@/lib/admin";
import { getEntitlements, type Plan } from "@/lib/entitlements";
import { BillingPlans } from "@/components/billing/BillingPlans";
import { PlanPreview } from "@/components/vendor/PlanPreview";

// Subscription / pricing page. Resolves the vendor's current plan server-side,
// then the client component handles Stripe Checkout + Billing Portal.
export const dynamic = "force-dynamic";

export default async function VendorBillingPage() {
  const { userId } = await auth();
  const actor = await resolveActor().catch(() => null);
  let currentPlan: Plan = "free";
  if (actor?.memberId) {
    const ent = await getEntitlements(actor.memberId);
    currentPlan = ent.plan;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      {/* Tier preview lives here (admins only) — it's demo scaffolding, so it
          stays off the dashboard and out of the Messages tab. */}
      <PlanPreview isAdmin={isAdmin(userId)} />

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Join or activate the network</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-stone-500">
          Choose how you want to participate in the local ecosystem. Upgrade or cancel anytime.
        </p>
      </div>
      <BillingPlans currentPlan={currentPlan} memberId={actor?.memberId ?? null} />
    </div>
  );
}
