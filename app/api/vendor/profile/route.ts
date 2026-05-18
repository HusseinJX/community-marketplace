import { NextResponse } from 'next/server'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { setVendorProfile } from '@/lib/vendor-connect'

export async function POST(request: Request) {
  const { user } = await withAuth()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { memberId }: { memberId: string } = body

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  await setVendorProfile(user.id, memberId, user.email ?? null)

  return NextResponse.json({ ok: true })
}
