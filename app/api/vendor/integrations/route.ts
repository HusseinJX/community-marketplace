import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile, getVendorSettings } from '@/lib/vendor-connect'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const settings = await getVendorSettings(profile.member_id)
  return NextResponse.json({ settings })
}
