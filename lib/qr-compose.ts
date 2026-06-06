import sharp from 'sharp'
import QRCode from 'qrcode'

// ──────────────────────────────────────────────────────────────────────────
// Server-only (imports sharp). Tier-1 helper: lay a REAL QR matrix on a white
// card centered over an arbitrary background image, so the result always scans
// regardless of how busy the background is. Deliberately separate from
// `lib/qr.ts` (which the client imports) — sharp must never reach the browser.
// ──────────────────────────────────────────────────────────────────────────

export interface ComposeOpts {
  /** Output square size in px. Default 1024. */
  size?: number
  /** QR foreground color. Default near-black. */
  dark?: string
}

/**
 * @param background PNG/JPEG buffer (e.g. an AI-generated image).
 * @param url        The destination the QR encodes.
 * @returns PNG buffer: background, a white rounded card, and the QR centered.
 */
export async function composeStyledQr(
  background: Buffer,
  url: string,
  opts: ComposeOpts = {}
): Promise<Buffer> {
  const size = opts.size ?? 1024
  const card = Math.round(size * 0.547) // ~560 at 1024
  const qr = Math.round(size * 0.449) // ~460 at 1024
  const radius = Math.round(size * 0.043)

  const qrBuf = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    width: qr,
    margin: 0,
    color: { dark: opts.dark ?? '#0c0a09', light: '#ffffff' },
  })

  const cardSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${card}" height="${card}">` +
      `<rect width="${card}" height="${card}" rx="${radius}" fill="#ffffff"/></svg>`
  )

  return sharp(background)
    .resize(size, size, { fit: 'cover' })
    .composite([
      { input: cardSvg, gravity: 'center' },
      { input: qrBuf, gravity: 'center' },
    ])
    .png()
    .toBuffer()
}
