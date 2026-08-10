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
    <p style="margin:0 0 24px"><a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">View invite</a></p>
    <p style="margin:0;color:#a8a29e;font-size:13px">WhatsLocal AI · local businesses, collaborating</p>
  </div>`
  const text = `${who} invited you to collaborate on WhatsLocal.${opts.message ? `\n\n"${opts.message}"` : ''}\n\nView it: ${opts.ctaUrl}`
  return sendEmail({ to: opts.to, subject, html, text })
}

// The tickets themselves, as an email.
//
// For a guest buyer with no account this email IS the ticket — there is no
// other place their purchase exists from their side — so it carries the QR
// inline (as a hosted image, since Gmail strips data: URIs) AND the short code
// as text, for the case where images are blocked at the door.
export async function sendTicketEmail(opts: {
  to: string | null
  eventTitle: string
  eventWhen: string | null
  eventWhere: string | null
  hostName: string | null
  tickets: { token: string; code: string; typeName: string | null }[]
  ticketUrlFor: (token: string) => string
  manageUrl: string
}): Promise<boolean> {
  if (!emailConfigured() || !opts.to || opts.tickets.length === 0) return false

  const n = opts.tickets.length
  const subject = `${n === 1 ? 'Your ticket' : `Your ${n} tickets`} — ${opts.eventTitle}`
  const when = opts.eventWhere || opts.eventWhen
    ? `<p style="margin:0 0 20px;color:#57534e">${escapeHtml([opts.eventWhen, opts.eventWhere].filter(Boolean).join(' · '))}</p>`
    : ''

  const cards = opts.tickets
    .map((t, i) => {
      const url = opts.ticketUrlFor(t.token)
      return `<table role="presentation" width="100%" style="border:1px solid #e7e5e4;border-radius:14px;margin:0 0 12px">
        <tr><td style="padding:18px;text-align:center">
          ${n > 1 ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e">Ticket ${i + 1} of ${n}</p>` : ''}
          ${t.typeName ? `<p style="margin:0 0 12px;font-weight:600">${escapeHtml(t.typeName)}</p>` : ''}
          <img src="${escapeHtml(url)}/qr.png" width="200" height="200" alt="Ticket QR code" style="display:block;margin:0 auto 12px;border-radius:8px" />
          <p style="margin:0 0 4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;letter-spacing:.1em;font-weight:600">${escapeHtml(t.code)}</p>
          <p style="margin:0 0 14px;color:#a8a29e;font-size:13px">Show this code if the QR won't scan</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px">Open ticket</a>
        </td></tr>
      </table>`
    })
    .join('')

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1c1917;max-width:480px">
    <p style="margin:0 0 6px;font-size:20px;font-weight:700">${escapeHtml(opts.eventTitle)}</p>
    ${when}
    ${cards}
    <p style="margin:16px 0 0;color:#57534e;font-size:14px">Save this email — the link above works without an account. <a href="${escapeHtml(opts.manageUrl)}" style="color:#4f46e5">See all your tickets</a>.</p>
    <p style="margin:16px 0 0;color:#a8a29e;font-size:13px">${opts.hostName ? `${escapeHtml(opts.hostName)} · ` : ''}WhatsLocal AI</p>
  </div>`

  const text = [
    opts.eventTitle,
    [opts.eventWhen, opts.eventWhere].filter(Boolean).join(' · '),
    '',
    ...opts.tickets.map((t, i) => `${n > 1 ? `Ticket ${i + 1}: ` : ''}${t.code}\n${opts.ticketUrlFor(t.token)}`),
  ]
    .filter((l) => l !== null)
    .join('\n')

  return sendEmail({ to: opts.to, subject, html, text })
}

// The download links for a purchase.
//
// Like the ticket email, this IS the product for a guest buyer — there is no
// other place their purchase exists from their side — so it leads with the
// links and says plainly that they keep working.
export async function sendDigitalEmail(opts: {
  to: string | null
  vendorName: string | null
  items: { productName: string; url: string; fileName: string | null }[]
}): Promise<boolean> {
  if (!emailConfigured() || !opts.to || opts.items.length === 0) return false

  const n = opts.items.length
  const subject = n === 1 ? `Your download: ${opts.items[0].productName}` : `Your ${n} downloads`

  const rows = opts.items
    .map(
      (i) => `<table role="presentation" width="100%" style="border:1px solid #e7e5e4;border-radius:14px;margin:0 0 12px">
      <tr><td style="padding:16px">
        <p style="margin:0 0 4px;font-weight:600">${escapeHtml(i.productName)}</p>
        ${i.fileName ? `<p style="margin:0 0 12px;color:#a8a29e;font-size:13px">${escapeHtml(i.fileName)}</p>` : ''}
        <a href="${escapeHtml(i.url)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px">Download</a>
      </td></tr>
    </table>`
    )
    .join('')

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1c1917;max-width:480px">
    <p style="margin:0 0 6px;font-size:20px;font-weight:700">Thanks for your order</p>
    <p style="margin:0 0 20px;color:#57534e">${n === 1 ? 'Your download is ready.' : 'Your downloads are ready.'}</p>
    ${rows}
    <p style="margin:16px 0 0;color:#57534e;font-size:14px">Keep this email — the links above work whenever you need them, on any device.</p>
    <p style="margin:16px 0 0;color:#a8a29e;font-size:13px">${opts.vendorName ? `${escapeHtml(opts.vendorName)} · ` : ''}WhatsLocal AI</p>
  </div>`

  const text = [
    'Thanks for your order. Your downloads are ready.',
    '',
    ...opts.items.map((i) => `${i.productName}\n${i.url}`),
  ].join('\n')

  return sendEmail({ to: opts.to, subject, html, text })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
