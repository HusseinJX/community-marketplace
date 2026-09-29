import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { getVendorProfile } from '@/lib/vendor-connect'
import { isAdmin } from '@/lib/admin'
import { demoMemberId, isDemoActive } from '@/lib/demo-server'
import { getMember } from '@/lib/api'
import { memberImages } from '@/lib/member-images'
import { BusinessProfileEditor, type BusinessDetails } from '@/components/vendor/BusinessProfileEditor'

export const metadata = { title: 'Business profile' }

// The vendor's own page, editable: the details a shopper reads, and every link
// they can be found through.
//
// Details are loaded here (server-side, one connector call). LINKS ARE NOT —
// they live in three places and the /links route already knows how to
// reassemble them, so the editor fetches them itself rather than this page
// growing a second copy of that rule.
export default async function VendorAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>
}) {
  const { userId } = await auth()
  const { memberId: requested } = await searchParams
  const demo = !userId && (await isDemoActive())
  const profile = userId ? await getVendorProfile(userId) : null
  // Admins may edit any business (Act on behalf) — same rule the products,
  // events and live pages already follow, and the same rule the PATCH route
  // enforces server-side via resolveActor(). Everyone else edits their own.
  const admin = isAdmin(userId)
  const memberId =
    (admin && requested) || profile?.member_id || (demo ? await demoMemberId() : null)
  const onBehalf = !!(admin && requested && requested !== profile?.member_id)

  let details: BusinessDetails = {}
  let images: string[] = []
  if (memberId) {
    try {
      // fresh: this is the screen that EDITS the profile, so it must never
      // show a cached copy of what was just saved (see getMember).
      const m = await getMember(memberId, { fresh: true })
      const p = (m as {
        member?: {
          profile?: {
            name?: string; businessName?: string; businessDescription?: string; bio?: string; story?: string
            category?: string; city?: string; neighborhood?: string
            businessAddress?: string; businessHours?: string
            images?: string[]; imageUrl?: string
          }
        }
      })?.member?.profile
      details = {
        name: p?.businessName || p?.name || undefined,
        bio: p?.businessDescription || p?.bio || undefined,
        story: p?.story || undefined,
        category: p?.category || undefined,
        city: p?.city || undefined,
        neighborhood: p?.neighborhood || undefined,
        address: p?.businessAddress || undefined,
        hours: p?.businessHours || undefined,
      }
      // The same list the public page draws, in the same order — editing it
      // anywhere else would be editing something the vendor can't see.
      images = memberImages({ id: memberId, profile: p ?? null })
    } catch {
      /* connector slow/unavailable → an empty form rather than an error page */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Business profile</h1>
        {onBehalf ? (
          // Acting on behalf edits SOMEONE ELSE'S public page, so say whose
          // before the form does anything — same badge products/events show.
          <p className="mt-1 text-sm text-stone-500">
            Editing{' '}
            <span className="font-medium text-stone-900">{details.name || memberId}</span>
            <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">admin</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-stone-500">
            Everything shoppers see on your page — your details and all your links.
          </p>
        )}
      </div>

      {memberId ? (
        <BusinessProfileEditor
          memberId={memberId}
          initialDetails={details}
          initialImages={images}
          publicHref={`/members/${memberId}`}
        />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Link your member profile first</p>
          <p className="mt-1 text-sm text-amber-700">
            Connect your store profile to edit your public details.
          </p>
          <Link
            href="/vendor/setup"
            className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
          >
            Get started
          </Link>
        </div>
      )}
    </div>
  )
}
