import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import jsQR from 'jsqr'
import { composeStyledQr } from '@/lib/qr-compose'
import { memberProfileUrl } from '@/lib/qr'

// Deterministic + FREE — no OpenAI/Supabase calls. Proves the Tier-1 guarantee:
// the real QR composited over a busy background still decodes to the right URL.
// (The OpenAI background generation itself is exercised manually with the flag
// on, per the "run billable AI deliberately" norm.)

// A noisy synthetic "background" that stands in for an AI-generated image —
// the QR must survive being laid over it.
async function noisyBackground(size = 1024): Promise<Buffer> {
  const noise = Buffer.alloc(size * size * 3)
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 256
  return sharp(noise, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer()
}

async function decode(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height)
  return result?.data ?? null
}

describe('composeStyledQr', () => {
  it('produces a 1024×1024 PNG', async () => {
    const out = await composeStyledQr(await noisyBackground(), memberProfileUrl('demo-1'))
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(1024)
    expect(meta.height).toBe(1024)
  })

  it('the composited QR still scans back to the exact profile URL', async () => {
    const url = memberProfileUrl('demo-1')
    const out = await composeStyledQr(await noisyBackground(), url)
    expect(await decode(out)).toBe(url)
  })

  it('respects a custom output size', async () => {
    const out = await composeStyledQr(await noisyBackground(512), memberProfileUrl('x'), { size: 512 })
    const meta = await sharp(out).metadata()
    expect(meta.width).toBe(512)
  })
})
