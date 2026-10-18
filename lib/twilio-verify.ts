import 'server-only'

/**
 * Twilio Verify, called directly — EVERY ownership code goes through here:
 * a fresh listing and an existing (canvassed, carded) page alike. The code is
 * keyed to the PHONE, which is all Verify needs, so a listing with no member
 * yet verifies the same way as a page that exists. Same Verify service the
 * connector used, so the same pre-vetted 2FA sender pool and no 10DLC.
 *
 * Twilio generates, delivers, expires and attempt-caps the code. We never see
 * or store it.
 */

/**
 * LOCAL TESTING ONLY: skip Twilio — no text goes out and any 6 digits pass.
 * Needs BOTH `next dev` (NODE_ENV=development; `next start` and every build is
 * production) AND JOIN_DEV_SKIP_CODE=1 in .env.local, which never reaches the
 * container. Two guards so neither alone can turn it on in prod.
 */
export function devSkipCode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.JOIN_DEV_SKIP_CODE === '1'
}

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const service = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!sid || !token || !service) return null
  return { auth: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, service }
}

export function verifyConfigured(): boolean {
  return devSkipCode() || creds() !== null
}

async function post(path: string, form: Record<string, string>) {
  const c = creds()
  if (!c) throw new Error('verify_unconfigured')
  const res = await fetch(`https://verify.twilio.com/v2/Services/${c.service}/${path}`, {
    method: 'POST',
    headers: { Authorization: c.auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; code?: number }
  return { ok: res.ok, status: res.status, data }
}

/** Send a code. `call` reads it out — the answer for a landline. */
export async function sendCode(to: string, channel: 'sms' | 'call' = 'sms'): Promise<{ sent: boolean; error?: string }> {
  if (devSkipCode()) {
    console.warn(`[twilio-verify] DEV SKIP — no code sent to ${to}; any 6 digits will pass`)
    return { sent: true }
  }
  const r = await post('Verifications', { To: to, Channel: channel })
  if (!r.ok) return { sent: false, error: r.data.message || `twilio ${r.status}` }
  return { sent: true }
}

/** True only when Twilio says "approved". A 404 means expired / used / never sent. */
export async function checkCode(to: string, code: string): Promise<boolean> {
  if (devSkipCode()) return /^\d{6}$/.test(code)
  const r = await post('VerificationCheck', { To: to, Code: code })
  return r.ok && r.data.status === 'approved'
}
