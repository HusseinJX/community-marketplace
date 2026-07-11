import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isDemoActive } from '@/lib/demo-server'
import { VendorNav } from '@/components/vendor/VendorNav'
import { VendorBackBar } from '@/components/vendor/VendorBackBar'
import { VendorSignOut } from '@/components/vendor/VendorSignOut'

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

  let email = ''
  if (userId) {
    const user = await currentUser()
    email = user?.emailAddresses?.[0]?.emailAddress ?? ''
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <VendorNav />
          {!demo && (
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-sm text-stone-500 md:inline">{email}</span>
              <VendorSignOut />
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <VendorBackBar />
        {children}
      </main>
    </div>
  )
}
