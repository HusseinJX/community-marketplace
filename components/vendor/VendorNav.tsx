'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Two tabs, two jobs:
//   Home     = find — the matcher + opportunities near you.
//   Messages = talk — ONE inbox: Collaborations + Customers (incl. your AI agent).
// Collabs and Messages were separate tabs, which meant two inboxes and no way to
// know which one held your unread message. Everything else (Resources, billing,
// products…) lives on the dashboard list, not in primary nav.
const NAV = [
  { href: '/vendor', label: 'Home' },
  { href: '/vendor/messages', label: 'Messages' },
]

export function VendorNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/vendor' ? pathname === '/vendor' : pathname === href || pathname.startsWith(href + '/')

  // Both tabs sit together on the left. (This was justify-between on mobile,
  // which flung Messages to the far edge, away from Home.)
  return (
    <nav className="flex min-w-0 flex-1 items-center justify-start gap-1">
      {NAV.map((n) => {
        const active = isActive(n.href)
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={
              'whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium transition active:scale-95 sm:text-sm ' +
              (active
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900')
            }
          >
            {n.label}
          </Link>
        )
      })}
    </nav>
  )
}
