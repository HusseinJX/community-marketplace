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
