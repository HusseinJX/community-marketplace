import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { getMember } from '@/lib/api'

export const runtime = 'nodejs'

// GET → the signed-in user's business location as a readable label, or null.
// Used by the share composer to offer a "current vs business location" toggle
// (only vendors/orgs/artists with a linked member + a location get the toggle).
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ location: null })

  const profile = await getVendorProfile(userId)
  if (!profile?.member_id) return NextResponse.json({ location: null })

  try {
    const p = (await getMember(profile.member_id)).member?.profile ?? {}
    const label =
      (p.businessAddress as string) ||
      [p.neighborhood, p.city].filter(Boolean).join(', ') ||
      (p.city as string) ||
      ''
    // The business's own coordinates, when the profile carries them (~93% do).
    // Sent alongside the label so a post tagged to the shop is placed at the
    // SHOP, not wherever the phone happens to be. Null when absent — never the
    // device's fix standing in for the business's.
    const lat = typeof p.latitude === 'number' ? p.latitude : null
    const lng = typeof p.longitude === 'number' ? p.longitude : null
    return NextResponse.json({ location: label.trim() || null, lat, lng })
  } catch {
    return NextResponse.json({ location: null })
  }
}
