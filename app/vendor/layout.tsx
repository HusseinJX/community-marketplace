import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isDemoActive } from '@/lib/demo-server'
import { VendorChrome } from '@/components/vendor/VendorChrome'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  // AUTH GATE ONLY. The visual chrome (header / padding / back bar) is decided
  // CLIENT-side in <VendorChrome> via usePathname — never here — because Next
  // persists this shared Server-Component layout across client navigation, so
  // its headers() pathname goes stale on sub-routes. That staleness used to make
  // the layout keep rendering bare (no <main>, no padding) after you signed in,
  // because it still thought the path was /vendor/sign-in. See VendorChrome.
  //
  // The gate is safe against that staleness: for a signed-in user `userId` is
  // truthy so no redirect fires regardless of the path; the sign-in-path check
  // only has to hold on a fresh unauthenticated load, which is accurate.
  const pathname = (await headers()).get('x-pathname') ?? ''
  const demo = !userId && (await isDemoActive())
  if (!userId && !demo && pathname !== '/vendor/sign-in') redirect('/vendor/sign-in')

  return <VendorChrome>{children}</VendorChrome>
}
