import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile } from '@/lib/vendor-connect'
import { getMember } from '@/lib/api'

export const runtime = 'nodejs'

// GET → who the signed-in user IS as a business: their member id, its name,
// and its location as a readable label.
//
// The share composer needs all three and they come from the same lookup, so
// they travel together rather than as three requests: the location tags a
// vendor's post automatically, and the id + name are the venue a vendor goes
// live AS — they are the business, so there is nothing for them to pick.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ memberId: null, name: null, location: null })

  const profile = await getVendorProfile(userId)
  if (!profile?.member_id) return NextResponse.json({ memberId: null, name: null, location: null })

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
    return NextResponse.json({
      memberId: profile.member_id,
      name: ((p.businessName as string) || (p.name as string) || '').trim() || null,
      location: label.trim() || null,
      lat,
      lng,
    })
  } catch {
    // The connector is slow or down. The id is still known and is the half
    // that matters — without it a vendor cannot go live at all.
    return NextResponse.json({ memberId: profile.member_id, name: null, location: null })
  }
}
