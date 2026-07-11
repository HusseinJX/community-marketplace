'use client'

// Shared Free / Basic / Pro preview switch. All instances read/write the same
// localStorage key (`wl_plan_preview`), so the tier picked on the dashboard is
// inherited on the collab page and vice-versa. "Basic" == the `member` plan.
export const PLAN_KEY = 'wl_plan_preview'
export type Tier = 'free' | 'member' | 'pro'
const TIERS: { key: Tier; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'member', label: 'Basic' },
  { key: 'pro', label: 'Pro' },
]

export function PlanSwitch({
  tier, onPick, caption = 'Preview each tier.',
}: { tier: Tier; onPick: (t: Tier) => void; caption?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-900">Plan</p>
          <p className="hidden text-xs text-stone-500 sm:block">{caption}</p>
        </div>
        <div className="inline-flex rounded-lg bg-stone-100 p-1">
          {TIERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onPick(t.key)}
              className={
                'rounded-md px-3 py-1.5 text-xs font-semibold transition ' +
                (tier === t.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
