import { NextResponse } from 'next/server'
import { getConfirmedContributions } from '@/lib/contributions'

// GET — public: a member's confirmed gifts, for the "Gives back" profile badge.
export async function GET(_req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params
  try {
    const contributions = await getConfirmedContributions(memberId)
    return NextResponse.json({ contributions })
  } catch {
    return NextResponse.json({ contributions: [] })
  }
}
