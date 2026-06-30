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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
