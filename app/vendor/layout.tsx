import { auth, currentUser } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@clerk/nextjs'
import { isAdmin } from '@/lib/admin'
import { isDemoMode, isDemoType, DEMO_COOKIE, DEMO_TYPE_LABEL, type DemoMemberType } from '@/lib/demo-admin'
import { DemoTypeSwitcher } from '@/components/DemoTypeSwitcher'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  // Demo mode lets the portal be previewed without auth so each member type's
  // admin UI is testable. Gated by NEXT_PUBLIC_DEMO_MODE — off = full protection.
  const demo = !userId && isDemoMode()
  if (!userId && !demo) redirect('/vendor/sign-in')

  let email = ''
  let admin = false
  let demoType: DemoMemberType = 'vendor'
  if (userId) {
    const user = await currentUser()
    email = user?.emailAddresses?.[0]?.emailAddress ?? ''
    admin = isAdmin(userId)
  } else {
    const c = (await cookies()).get(DEMO_COOKIE)?.value
    demoType = isDemoType(c) ? c : 'vendor'
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          <span>
            Demo admin — viewing as <b>{DEMO_TYPE_LABEL[demoType]}</b>
          </span>
          <div className="flex items-center gap-3">
            <DemoTypeSwitcher current={demoType} />
            <Link href="/" className="text-xs font-medium underline hover:no-underline">
              Exit demo
            </Link>
          </div>
        </div>
      )}
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/vendor" className="text-sm font-semibold text-stone-900">
              Vendor Portal
            </Link>
            <Link href="/vendor/live" className="text-sm font-medium text-rose-600 hover:text-rose-800">
              Go Live
            </Link>
            <Link href="/vendor/collabs" className="text-sm text-stone-500 hover:text-stone-900">
              Collabs
            </Link>
            <Link href="/vendor/resources" className="text-sm text-stone-500 hover:text-stone-900">
              Resources
            </Link>
            <Link href="/vendor/qr" className="text-sm text-stone-500 hover:text-stone-900">
              QR code
            </Link>
            {admin && (
              <Link href="/vendor/featured" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                Featured
              </Link>
            )}
          </div>
          {!demo && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-500">{email}</span>
              <SignOutButton redirectUrl="/vendor/sign-in">
                <button className="text-sm text-stone-500 hover:text-stone-900">Sign out</button>
              </SignOutButton>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
