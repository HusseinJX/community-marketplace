import { NextResponse } from 'next/server'
import { resolveActor } from '@/lib/admin'
import { gateCapability } from '@/lib/gate'
import { isAdmin } from '@/lib/admin'
import { uploadDigitalFile, digitalConfigured } from '@/lib/digital'

// Upload the file behind a digital product.
//
// Separate from /api/upload, which puts images in the PUBLIC media bucket. A
// paid download in a public bucket would mean the object URL is the product:
// paste it anywhere and the paywall is gone permanently. This one writes to the
// private bucket and returns only an object path, which the browser stores on
// the product and never resolves itself.

// Generous but finite. Big enough for an ebook, an album, a preset pack or a
// video course chapter; small enough that one upload can't fill the bucket.
const MAX_BYTES = 200 * 1024 * 1024

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })

  const requested = (form.get('memberId') as string) || null
  const actor = await resolveActor(requested)
  if (!actor) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  if (actor.isDemo) return NextResponse.json({ error: 'Not available in demo' }, { status: 403 })

  const gated = await gateCapability(actor.memberId, 'commerce', { bypass: isAdmin(actor.userId) })
  if (gated) return gated

  // Say this plainly rather than accepting a file we can't ever serve: signing
  // a private object needs the service-role key, so without it the vendor would
  // upload successfully and every buyer would hit a dead link.
  if (!digitalConfigured()) {
    return NextResponse.json(
      { error: 'Digital downloads aren\'t switched on for the marketplace yet.' },
      { status: 503 }
    )
  }

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'That file is empty.' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(0)}MB — the limit is ${MAX_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { path } = await uploadDigitalFile(buffer, {
      memberId: actor.memberId,
      filename: file.name || 'download',
      contentType: file.type || undefined,
    })
    // The path is not a URL and cannot be fetched — resolving it requires a
    // signature only the server can produce.
    return NextResponse.json({ path, name: file.name, size: file.size })
  } catch (error: unknown) {
    console.error('digital file upload failed:', error)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
