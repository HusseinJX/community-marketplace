'use client'

import { DEMO_TYPES, writeDemoCookies, type DemoMemberType } from '@/lib/demo-admin'

// In-portal switcher for demo mode: flips the acting member type (cookie) and
// reloads so the admin UI re-renders in that type's context.
export function DemoTypeSwitcher({ current }: { current: DemoMemberType }) {
  function setType(t: DemoMemberType) {
    writeDemoCookies(t)
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-1">
      {DEMO_TYPES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setType(t.key)}
          className={
            'rounded-full px-2.5 py-0.5 text-xs font-medium transition ' +
            (current === t.key
              ? 'bg-amber-900 text-white'
              : 'bg-white/70 text-amber-900 hover:bg-white')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
