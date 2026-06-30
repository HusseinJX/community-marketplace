import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getVendorProfile, addBusinessKnowledge } from '@/lib/vendor-connect'
import { extractText, getDocumentProxy } from 'unpdf'

export const runtime = 'nodejs'

// Cap per-doc so a big PDF doesn't blow the assistant's context window.
const MAX_CHARS = 6000

// POST (multipart) — drop a PDF; extract its text and store it as assistant
// knowledge (source 'pdf'), fed into buildBusinessContext like a typed note.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.type && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Please upload a PDF' }, { status: 400 })
  }
  const name = (form.get('filename')?.toString() || (file as File).name || 'document.pdf').slice(0, 120)

  let text = ''
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocumentProxy(buf)
    const res = await extractText(pdf, { mergePages: true })
    const raw = Array.isArray(res.text) ? res.text.join('\n') : res.text || ''
    text = raw.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return NextResponse.json({ error: "Couldn't read that PDF" }, { status: 422 })
  }
  if (!text) {
    return NextResponse.json(
      { error: 'No text found — is it a scanned image? Try pasting the text instead.' },
      { status: 422 }
    )
  }

  const truncated = text.length > MAX_CHARS
  const content = `From "${name}":\n${text.slice(0, MAX_CHARS)}${truncated ? '\n…(truncated)' : ''}`
  await addBusinessKnowledge(profile.member_id, content, 'pdf')
  return NextResponse.json({ ok: true, chars: text.length, truncated })
}
