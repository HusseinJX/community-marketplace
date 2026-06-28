import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@clerk/nextjs'
import { isAdmin } from '@/lib/admin'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/vendor/sign-in')

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''
  const admin = isAdmin(userId)

  return (
    <div className="min-h-screen bg-stone-50">
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
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500">{email}</span>
            <SignOutButton redirectUrl="/vendor/sign-in">
              <button className="text-sm text-stone-500 hover:text-stone-900">Sign out</button>
            </SignOutButton>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
