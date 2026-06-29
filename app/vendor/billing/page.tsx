import Link from "next/link";
import { Sparkles, Check } from "lucide-react";
import { FREE_IMAGE_LIMIT } from "@/lib/ai-credits";

// Placeholder upgrade page. A real subscription (Stripe) isn't wired yet — this
// explains the premium tier and routes interest to us. The AI-image quota in
// /api/ai/detect-products already enforces the free cap; flipping a member to
// premium today is a manual `ai_image_credits.premium = true` until billing ships.
export default function VendorBillingPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
          <Sparkles className="h-6 w-6 text-indigo-500" /> Go Premium
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          You get {FREE_IMAGE_LIMIT} free AI product images. Premium unlocks unlimited catalog
          generation (fair-use rate limited) plus priority processing.
        </p>
      </div>

      <div className="card-soft space-y-3 p-5">
        <p className="section-label">Premium includes</p>
        <ul className="space-y-2 text-sm text-stone-700">
          {[
            "AI product images beyond the free 3",
            "Counter / shelf scanning at full volume",
            "Priority generation",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" /> {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Subscriptions are rolling out. To enable premium on your account now, email{" "}
        <a href="mailto:hello@whatslocal.ai?subject=Premium%20upgrade" className="font-medium underline">
          hello@whatslocal.ai
        </a>
        .
      </div>

      <Link href="/vendor" className="inline-block text-sm text-stone-500 hover:text-stone-800">
        ← Back to dashboard
      </Link>
    </div>
  );
}
