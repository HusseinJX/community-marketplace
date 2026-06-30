'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/vendor', label: 'Home' },
  { href: '/vendor/network', label: 'Collabs' }, // find & invite collaborators + rooms
  { href: '/vendor/resources', label: 'Resources' },
]

export function VendorNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/vendor' ? pathname === '/vendor' : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="flex min-w-0 flex-1 items-center justify-between gap-0.5 sm:justify-start sm:gap-1">
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
