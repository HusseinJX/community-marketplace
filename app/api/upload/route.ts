import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { uploadImage } from '@/lib/storage'
import { youtubeConfigured, uploadVideo } from '@/lib/youtube'

export const runtime = 'nodejs'

// Accepts a multipart upload. Images (menu/flyer/counter photo) go to Supabase
// Storage; videos go to our central YouTube channel (unlisted) and return the
// watch URL. Authed: vendor on their own member, or an admin on any.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 })

  const requestedMember = form.get('memberId')?.toString() || undefined
  const actor = await resolveActor(requestedMember)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const type = file.type || 'image/png'

  // Videos → YouTube (unlisted), never Supabase.
  if (type.startsWith('video')) {
    if (!youtubeConfigured()) {
      return NextResponse.json({ error: 'Video upload is not configured yet.' }, { status: 503 })
    }
    try {
      const { videoUrl } = await uploadVideo(buf, {
        title: `WhatsLocal — ${new Date().toISOString().slice(0, 10)}`,
      })
      return NextResponse.json({ url: videoUrl, kind: 'video', memberId: actor.memberId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video upload failed'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg')
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { publicUrl } = await uploadImage(buf, {
    prefix: `uploads/${actor.memberId}`,
    filename,
    contentType: type,
  })

  return NextResponse.json({ url: publicUrl, kind: 'image', memberId: actor.memberId })
}
