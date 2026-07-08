// Transactional email via Resend's REST API (no SDK dependency). No-ops until
// RESEND_API_KEY + RESEND_FROM are set, mirroring how commerce no-ops without
// Composio keys.
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html?: string
  text?: string
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM // e.g. "WhatsLocal AI <events@whatslocal.ai>"
  if (!key || !from) return false
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : [opts.to].filter(Boolean)
  if (to.length === 0) return false
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html ?? undefined,
        text: opts.text ?? (opts.html ? undefined : opts.subject),
      }),
    })
    return res.ok
  } catch (e) {
    console.error('sendEmail failed:', e)
    return false
  }
}

// Send the same message to many recipients individually (so addresses aren't
// disclosed to each other). Returns the count accepted.
export async function sendEmailBatch(
  recipients: string[],
  subject: string,
  body: string
): Promise<number> {
  if (!emailConfigured()) return 0
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1c1917">${body
    .split('\n')
    .map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`)
    .join('')}</div>`
  const results = await Promise.all(
    recipients.filter(Boolean).map((to) => sendEmail({ to, subject, html, text: body }))
  )
  return results.filter(Boolean).length
}

// A collaboration invite as an email — just another channel so the invitee (a
// claimed member with an on-file account email) doesn't miss it. Best-effort:
// no-ops when email isn't configured or there's no address.
export async function sendInviteEmail(opts: {
  to: string | null
  fromName: string | null
  message: string | null
  ctaUrl: string
}): Promise<boolean> {
  if (!emailConfigured() || !opts.to) return false
  const who = opts.fromName || 'A local business'
  const subject = `${who} invited you to collaborate on WhatsLocal`
  const note = opts.message
    ? `<p style="margin:0 0 16px;padding:12px 14px;background:#f5f5f4;border-radius:10px;color:#44403c">${escapeHtml(opts.message)}</p>`
    : ''
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1c1917;max-width:480px">
    <p style="margin:0 0 8px;font-size:18px;font-weight:600">${escapeHtml(who)} wants to collaborate</p>
    <p style="margin:0 0 16px;color:#57534e">You've got a new collaboration invite on WhatsLocal. Open your network to accept or decline.</p>
    ${note}
    <p style="margin:0 0 24px"><a href="${opts.ctaUrl}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">View invite</a></p>
    <p style="margin:0;color:#a8a29e;font-size:13px">WhatsLocal AI · local businesses, collaborating</p>
  </div>`
  const text = `${who} invited you to collaborate on WhatsLocal.${opts.message ? `\n\n"${opts.message}"` : ''}\n\nView it: ${opts.ctaUrl}`
  return sendEmail({ to: opts.to, subject, html, text })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
