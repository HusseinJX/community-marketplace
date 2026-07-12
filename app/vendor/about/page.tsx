import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { getVendorProfile } from '@/lib/vendor-connect'
import { demoMemberId, isDemoActive } from '@/lib/demo-server'
import { getMember } from '@/lib/api'
import { AboutSection, type VendorAbout } from '@/components/vendor/AboutSection'

export const metadata = { title: 'Business profile' }

// Dedicated edit page for the member's public "about" details (bio, category,
// location, links). Reached from the dashboard — a Quick-access "Profile" tile
// on Free/Basic, or the under-plan button on Pro.
export default async function VendorAboutPage() {
  const { userId } = await auth()
  const demo = !userId && (await isDemoActive())
  const profile = userId ? await getVendorProfile(userId) : null
  const memberId = profile?.member_id ?? (demo ? await demoMemberId() : null)

  let about: VendorAbout | null = null
  if (memberId) {
    try {
      const m = await getMember(memberId)
      const p = (m as {
        member?: {
          profile?: {
            businessDescription?: string; bio?: string; category?: string;
            city?: string; neighborhood?: string; instagramHandle?: string; websiteUrl?: string;
          }
        }
      })?.member?.profile
      about = {
        bio: p?.businessDescription || p?.bio || undefined,
        category: p?.category || undefined,
        city: p?.city || undefined,
        neighborhood: p?.neighborhood || undefined,
        instagram: p?.instagramHandle || undefined,
        website: p?.websiteUrl || undefined,
      }
    } catch {
      /* connector slow/unavailable → empty form */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Business profile</h1>
        <p className="mt-1 text-sm text-stone-500">
          Edit the bio, category, location, and links shoppers see on your profile.
        </p>
      </div>

      {memberId ? (
        <AboutSection about={about} memberId={memberId} startEditing />
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
