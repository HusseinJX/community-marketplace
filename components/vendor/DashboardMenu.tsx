'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Settings, UserCircle, Wrench } from 'lucide-react'

// The gear beside "+ Post": the two dashboard destinations that are about
// running the account rather than the day's selling — Tools (the agent,
// giving, resources) and Profile (edit, billing). They were two of the tile
// row's four buttons; the other two (Events, Messages) became section pills.
const ITEMS = [
  { href: '/vendor/tools', label: 'Tools', Icon: Wrench },
  { href: '/vendor/profile', label: 'Profile', Icon: UserCircle },
] as const

export function DashboardMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tools and profile"
        className={
          'inline-flex h-8 w-8 items-center justify-center rounded-full border transition active:scale-95 ' +
          (open
            ? 'border-stone-300 bg-stone-100 text-stone-900'
            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900')
        }
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          // right-0: the gear ends the title row, near the screen's right
          // edge, so the menu opens leftward — left-0 ran off a phone screen.
          className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-[var(--shadow-lift)]"
        >
          {ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-50"
            >
              <Icon className="h-4 w-4 text-indigo-500" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
