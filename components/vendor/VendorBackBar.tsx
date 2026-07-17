'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

// Pages that DON'T get a "Go back", for one of two reasons:
//  · top-level nav-tab destinations — you switch tabs from the navbar;
//  · pages that own a more specific back affordance ("Events", "Collaborations")
//    — a generic "Go back" stacked above it is just two back buttons.
const TAB_PATHS = new Set([
  '/vendor',
  '/vendor/live',
  '/vendor/messages',
  '/vendor/resources',
  '/vendor/qr',
  '/vendor/organize',
  '/vendor/event/new',
  '/vendor/collab/new',
])

// "Go back" button shown below the admin navbar on deeper pages — returns to the
// previous screen instead of all the way Home.
export function VendorBackBar() {
  const pathname = usePathname()
  const router = useRouter()
  if (TAB_PATHS.has(pathname)) return null
  return (
    <button
      onClick={() => router.back()}
      className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-900 active:scale-95"
    >
      <ChevronLeft className="h-4 w-4" /> Go back
    </button>
  )
}
