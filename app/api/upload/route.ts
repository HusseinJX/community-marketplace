import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { uploadImage } from '@/lib/storage'

export const runtime = 'nodejs'

// Accepts a multipart image upload (menu/flyer/counter photo) and stores it in
// Supabase Storage. Authed: vendor on their own member, or an admin on any.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 })

  const requestedMember = form.get('memberId')?.toString() || undefined
  const actor = await resolveActor(requestedMember)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { publicUrl } = await uploadImage(buf, {
    prefix: `uploads/${actor.memberId}`,
    filename,
    contentType: file.type || 'image/png',
  })

  return NextResponse.json({ url: publicUrl, memberId: actor.memberId })
}
