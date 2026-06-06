import QRCode from 'qrcode'
import { SITE_URL } from './seo'

// ──────────────────────────────────────────────────────────────────────────
// Basic QR — pure generation, zero AI, zero network. This is Tier 0 and is
// deliberately self-contained: nothing here imports any AI/image code, so the
// stylized/poster tiers can be flag-gated or deleted without touching this.
// `qrcode` is isomorphic (works in the browser), so the vendor UI generates
// QR codes client-side with no server round-trip.
// ──────────────────────────────────────────────────────────────────────────

/** The canonical destination a member's QR points to: their profile page. */
export function memberProfileUrl(memberId: string): string {
  return `${SITE_URL}/members/${memberId}`
}

export interface QrStyle {
  /** Pixel size of the rendered PNG (SVG scales freely). Default 512. */
  size?: number
  /** Foreground (dark) module color. Default near-black. */
  dark?: string
  /** Background (light) color. Default white. */
  light?: string
  /** Quiet-zone margin in modules. Default 2. */
  margin?: number
}

const DEFAULTS: Required<QrStyle> = {
  size: 512,
  dark: '#0c0a09', // stone-950
  light: '#ffffff',
  margin: 2,
}

function opts(style: QrStyle = {}) {
  const s = { ...DEFAULTS, ...style }
  return {
    width: s.size,
    margin: s.margin,
    // High error correction so the code survives logos/print/wear — and so the
    // same matrix can later sit on top of an AI background and still scan.
    errorCorrectionLevel: 'H' as const,
    color: { dark: s.dark, light: s.light },
  }
}

/** PNG data URL — ready for an <img src> or a download link. */
export function qrPngDataUrl(text: string, style?: QrStyle): Promise<string> {
  return QRCode.toDataURL(text, opts(style))
}

/** Crisp, infinitely-scalable SVG string — best for print. */
export function qrSvgString(text: string, style?: QrStyle): Promise<string> {
  return QRCode.toString(text, { ...opts(style), type: 'svg' })
}
