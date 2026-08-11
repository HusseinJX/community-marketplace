// Inbound phone number → business (member) routing.
//
// The whole trick of the phone agent is this lookup. The connector's older
// voice line asks "who is CALLING?" (caller ID → onboarding). A business line
// asks the opposite: "which number did they DIAL?" — that's the business, and
// everything else (context, greeting, leads) follows from it.
//
// Kept as a map for now because there is exactly one number on the Telnyx
// account. When numbers get provisioned per vendor this becomes a
// `vendor_phone_numbers` table and only this file changes — every caller goes
// through `memberIdForNumber`.
//
// Override without a deploy via BUSINESS_PHONE_MAP="+15551234567=<memberId>,..."

const BUILT_IN: Record<string, string> = {
  // WhatsLocal's Telnyx number → Xeno (SF)
  '+15622573224': '89516919-256f-4a95-96df-fc9d285f664a',
}

/** Normalize whatever the carrier hands us into E.164. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = String(raw).replace(/[^\d+]/g, '')
  if (!d) return null
  if (d.startsWith('+')) return d
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return `+${d}`
}

function envMap(): Record<string, string> {
  const raw = process.env.BUSINESS_PHONE_MAP
  if (!raw) return {}
  const out: Record<string, string> = {}
  for (const pair of raw.split(',')) {
    const [num, id] = pair.split('=').map((s) => s?.trim())
    const e164 = normalizePhone(num)
    if (e164 && id) out[e164] = id
  }
  return out
}

/** Which business owns this inbound number? null = not one of ours. */
export function memberIdForNumber(dialed: string | null | undefined): string | null {
  const e164 = normalizePhone(dialed)
  if (!e164) return null
  return envMap()[e164] ?? BUILT_IN[e164] ?? null
}

// A forwarded call arrives with a SIP Diversion header naming the number the
// caller ORIGINALLY dialed — verified live 2026-08-11:
//
//   <sip:+16287261846@208.89.64.233>;privacy=off;screen=no;reason=no-answer;counter=1
//
// This is what makes ONE shared number serve every business: a business points
// their existing number at ours instead of voicemail, and we identify them from
// this header. Without it we would need a number per business at $1/mo each.
//
// It exists ONLY in the assistant.initialization webhook at the start of the
// call — Telnyx does not persist it on the conversation record — so it must be
// read here or lost.
/** Pull the originally-dialed number out of a SIP Diversion header. */
export function parseDiversionNumber(header: string | null | undefined): string | null {
  if (!header) return null

  // Multiple hops stack most-recent-first (B forwards to C forwards to us =
  // "Diversion: <C>, Diversion: <B>"). The caller dialed the ORIGINAL, which is
  // the LAST entry — taking the first would name an intermediate hop.
  const hops = String(header).split(',')
  const original = hops[hops.length - 1]

  // sip:+1628...@host, tel:+1628..., or a bare number inside <>.
  const m = original.match(/(?:sips?|tel):\+?([0-9]+)/i) || original.match(/<\+?([0-9]+)/)
  return m ? normalizePhone(m[1]) : null
}

export interface CallRouting {
  /** The business, or null when we can't safely say whose call this is. */
  memberId: string | null
  /** The number the caller actually dialed (their number when forwarded). */
  businessNumber: string | null
  /** True when this reached us via call-forwarding rather than being dialed direct. */
  viaForward: boolean
}

/**
 * Resolve which business a call is for, honouring call-forwarding.
 *
 * The diversion header WINS over the dialed number: on a forwarded call `to` is
 * always OUR shared number, so routing on it would answer every forwarded call
 * as whichever business happens to own that number.
 *
 * When a call is forwarded from a number we don't recognise we return null
 * rather than falling back to `to`. That fallback is tempting and wrong — it
 * would answer as the shared number's business, i.e. confidently impersonate a
 * business the caller never rang. A generic "I can take a message" is the only
 * honest response to a call we can't attribute.
 */
export function resolveBusinessForCall(input: {
  dialed?: string | null
  diversion?: string | null
}): CallRouting {
  const forwardedFrom = parseDiversionNumber(input.diversion)

  if (forwardedFrom) {
    return {
      memberId: memberIdForNumber(forwardedFrom),
      businessNumber: forwardedFrom,
      viaForward: true,
    }
  }

  const dialed = normalizePhone(input.dialed)
  return {
    memberId: memberIdForNumber(dialed),
    businessNumber: dialed,
    viaForward: false,
  }
}
