import { NextResponse } from 'next/server'
import { JOINDEMO_COOKIE, JOINDEMO_PASSWORD } from '@/lib/joindemo'

export const runtime = 'nodejs'

// POST { password } — simple gate for the /joindemo walkthrough. On the right
// password, set an httpOnly cookie so the demo's read-only routes authorize.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const password = String(body.password ?? '')
  if (password !== JOINDEMO_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(JOINDEMO_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h — a demo session
  })
  return res
}
