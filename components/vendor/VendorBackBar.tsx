'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

// Pages that DON'T get a "Go back", for one of two reasons:
//  · the dashboard itself — it is where "back" goes;
//  · pages that own a more specific back affordance ("Events", "Collaborations",
//    the assistant chat's own arrow) — a generic "Go back" stacked above it is
//    just two back buttons, and on a full-height chat it pushes the composer
//    under the bottom nav.
// /vendor/messages is NOT here: it was reached from the Home/Messages tab row,
// and with that row gone "Go back" is its only way out.
const TAB_PATHS = new Set([
  '/vendor',
  '/vendor/live',
  '/vendor/messages/assistant',
  '/vendor/resources',
  '/vendor/qr',
  '/vendor/organize',
  '/vendor/event/new',
  '/vendor/collab/new',
])

// "Go back" button shown at the top of deeper portal pages — returns to the
// previous screen instead of all the way Home.
export function VendorBackBar() {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  if (TAB_PATHS.has(pathname)) return null

  // Super-admin uses in-page tabs switched via router.replace (no new history
  // entry), so a plain router.back() from a sub-tab (Organizer, Sourcing…)
  // leaves the admin page entirely. When we're in a sub-tab, send "Go back" to
  // the super-admin dashboard (its default view) instead.
  const adminSubTab =
    pathname === '/vendor/admin' && !!params.get('tab') && params.get('tab') !== 'create'
  const onBack = adminSubTab ? () => router.push('/vendor/admin') : () => router.back()

  return (
    // data-vendor-nav: hidden while a conversation is open (globals.css) —
    // the chat is sized to the full space between the app's navs.
    <button
      data-vendor-nav
      onClick={onBack}
      // Messages runs without the page's py-10 (it is a full-height chat
      // surface), so the row brings its own top gap there.
      className={
        'mb-5 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-900 active:scale-95 ' +
        (pathname.startsWith('/vendor/messages') ? 'mt-4' : '')
      }
    >
      <ChevronLeft className="h-4 w-4" /> Go back
    </button>
  )
}
