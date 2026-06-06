import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOpenAI, IMAGE_MODEL } from '@/lib/openai'
import { getVendorProfile } from '@/lib/vendor-connect'
import { uploadImage } from '@/lib/storage'
import { memberProfileUrl } from '@/lib/qr'
import { composeStyledQr } from '@/lib/qr-compose'

export const runtime = 'nodejs'

// ──────────────────────────────────────────────────────────────────────────
// Tier 1 — AI-stylized QR. Independent + flag-gated. Off unless
// NEXT_PUBLIC_QR_AI=1, so the default state is "basic only" (revertible).
//
// Reliability note: models can't generate a scannable QR. So we generate an AI
// *background*, then composite the REAL QR matrix (from `qrcode`) on a white
// card centered on top via `sharp`. The result is always scannable; if the AI
// call fails the client simply falls back to the basic generator.
// ──────────────────────────────────────────────────────────────────────────

const AI_ENABLED = process.env.NEXT_PUBLIC_QR_AI === '1'

const STYLES: Record<string, string> = {
  botanical: 'lush botanical illustration, leaves and flowers, soft natural light',
  neon: 'vibrant neon cyberpunk gradient, glowing geometric shapes, dark background',
  watercolor: 'soft pastel watercolor wash, gentle organic textures',
  retro: 'warm retro 1970s poster palette, bold sunburst shapes',
  marble: 'elegant marble and gold texture, luxury minimal',
}

export async function POST(req: Request) {
  if (!AI_ENABLED) {
    return NextResponse.json({ error: 'AI QR is disabled' }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getVendorProfile(userId)
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const styleKey = typeof body.style === 'string' && STYLES[body.style] ? body.style : 'botanical'
  const extra = typeof body.prompt === 'string' ? body.prompt.slice(0, 300).trim() : ''

  const prompt = [
    `A decorative square background image: ${STYLES[styleKey]}.`,
    extra,
    'Abstract, no text, no letters, no logos, no QR code. Keep the composition balanced so a panel can sit in the center.',
  ]
    .filter(Boolean)
    .join(' ')

  const url = memberProfileUrl(profile.member_id)

  try {
    const openai = getOpenAI()
    const gen = await openai.images.generate({ model: IMAGE_MODEL, prompt, size: '1024x1024' })
    const b64 = gen.data?.[0]?.b64_json
    if (!b64) throw new Error('No image returned')
    const bgBuf = Buffer.from(b64, 'base64')

    // Lay the real QR over the AI background — always scannable (see lib/qr-compose).
    const out = await composeStyledQr(bgBuf, url)

    const { publicUrl } = await uploadImage(out, {
      prefix: `qr/${profile.member_id}`,
      filename: `${Date.now()}-${styleKey}.png`,
      contentType: 'image/png',
    })

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    console.error('AI QR generation failed:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
