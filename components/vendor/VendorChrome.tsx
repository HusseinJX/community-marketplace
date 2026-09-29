'use client'

import { usePathname } from 'next/navigation'
import { VendorBackBar } from '@/components/vendor/VendorBackBar'

// The vendor portal's visual chrome (padded main + back bar). There is no
// portal tab row any more — the Home / Messages bar was removed 2026-09-29;
// Messages is a tile on the dashboard and every deeper page has "Go back".
//
// This is CLIENT-side on purpose. It reads the CURRENT route via usePathname
// instead of the Server layout's headers() pathname — because Next persists the
// shared Server-Component layout across client navigation, so that pathname goes
// stale on sub-routes. The concrete bug it caused: you enter the portal through
// /vendor/sign-in; after signing in you land on /vendor, but the persisted
// layout still saw pathname === '/vendor/sign-in' and kept returning bare
// children (no <main>, no padding, no back bar) for the ENTIRE portal.
// usePathname re-renders on every navigation, so it's always accurate.
export function VendorChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // The sign-in page is a public, self-contained landing — render it bare,
  // without the portal chrome, so it never sits inside the portal's padding.
  if (pathname === '/vendor/sign-in') return <>{children}</>

  // Messages is a chat surface, not a document: it fills its own height and pins
  // its composer above the bottom nav, so it drops the page's vertical padding
  // and min-height. Everything else keeps the normal chrome. (Horizontal
  // padding is ALWAYS applied so content never touches the screen edges.)
  const fullScreen = pathname.startsWith('/vendor/messages')

  return (
    <div className={fullScreen ? 'bg-stone-50' : 'min-h-screen bg-stone-50'}>
      <main className={`mx-auto max-w-5xl px-4 sm:px-6 ${fullScreen ? '' : 'py-10'}`}>
        <VendorBackBar />
        {children}
      </main>
    </div>
  )
}
