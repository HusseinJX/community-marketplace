import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { setVendorProfile } from '@/lib/vendor-connect'

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { memberId }: { memberId: string } = body

  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
  }

  const email = (sessionClaims?.email as string) ?? null
  await setVendorProfile(userId, memberId, email)

  return NextResponse.json({ ok: true })
}
