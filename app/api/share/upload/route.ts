import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadImage } from '@/lib/storage'
import { isDemoMode } from '@/lib/demo-admin'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Media upload for the share composer — any signed-in user (or demo). Unlike
// /api/upload (vendor-scoped), this is keyed by the poster's Clerk id.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId && !isDemoMode()) {
    return NextResponse.json({ error: 'Sign in to upload' }, { status: 401 })
  }

  const limited = rateLimit({ req, name: 'share-upload', id: userId, limit: 40, windowMs: 3_600_000 })
  if (limited) return limited

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const type = file.type || 'image/png'
  const ext = (type.split('/')[1] || 'bin').replace('jpeg', 'jpg')
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  try {
    const { publicUrl } = await uploadImage(buf, {
      prefix: `shares/${userId ?? 'demo'}`,
      filename,
      contentType: type,
    })
    return NextResponse.json({ url: publicUrl, kind: type.startsWith('video') ? 'video' : 'image' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
