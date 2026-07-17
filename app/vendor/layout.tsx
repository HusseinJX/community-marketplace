import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isDemoActive } from '@/lib/demo-server'
import { VendorNav } from '@/components/vendor/VendorNav'
import { VendorBackBar } from '@/components/vendor/VendorBackBar'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  // The sign-in page is a public, self-contained landing (shopper-style modal
  // login) — render it bare, without the portal chrome or the auth gate, so it
  // never redirects to itself.
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (pathname === '/vendor/sign-in') return <>{children}</>

  // Demo mode lets the portal be previewed without auth. Gated by
  // NEXT_PUBLIC_DEMO_MODE — off = full protection.
  const demo = !userId && (await isDemoActive())
  if (!userId && !demo) redirect('/vendor/sign-in')

  // Messages is a chat surface, not a document: it fills the screen between the
  // navs and pins its composer above the bottom nav, so it can't sit inside the
  // portal's page padding (py-10 would push the composer under the bottom nav)
  // and it owns its own back button. Everything else keeps the normal chrome.
  const fullScreen = pathname.startsWith('/vendor/messages')

  return (
    // `min-h-screen` would be a FULL viewport height *below* the app's top nav,
    // so the portal is always taller than the screen — harmless on a scrolling
    // page, fatal for a chat: it forces a page scroll and leaves dead space under
    // the composer. Full-screen routes size themselves off --vendor-chrome instead.
    <div className={fullScreen ? 'bg-stone-50' : 'min-h-screen bg-stone-50'}>
      {/* data-vendor-nav: an open chat hides this row (globals.css) so the
          conversation gets the whole screen. The layout is a server component and
          can't see the shell's chatOpen state, so the shell marks the body and CSS
          does the hiding — cheaper than making the whole portal chrome client-side. */}
      <header data-vendor-nav className="border-b border-stone-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <VendorNav />
        </div>
      </header>
      <main className={fullScreen ? 'mx-auto max-w-5xl' : 'mx-auto max-w-5xl px-6 py-10'}>
        {!fullScreen && <VendorBackBar />}
        {children}
      </main>
    </div>
  )
}
