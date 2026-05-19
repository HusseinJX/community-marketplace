import { NextResponse } from 'next/server'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { getVendorProfile, getVendorSettings } from '@/lib/vendor-connect'

export async function GET() {
  const { user } = await withAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const settings = await getVendorSettings(profile.member_id)
  return NextResponse.json({ settings })
}
