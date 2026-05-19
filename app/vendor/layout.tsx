import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@clerk/nextjs'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/vendor/sign-in')

  const email = (sessionClaims?.email as string) ?? ''

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/vendor" className="text-sm font-semibold text-stone-900">
            Vendor Portal
          </Link>
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
