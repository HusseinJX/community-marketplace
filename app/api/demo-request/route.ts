import { NextResponse } from 'next/server'
import { sendEmail, emailConfigured } from '@/lib/email'

// Where "Run a community" demo requests are delivered.
const TEAM_TO = process.env.DEMO_REQUEST_TO || 'hello@whatslocal.ai'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// POST — a demo request from the org/community promo ("Request a demo"). Emails
// the team via Resend and sends the requester a confirmation. Soft-succeeds when
// Resend isn't configured yet so the form UX still works.
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const email = (b.email ?? '').toString().trim()
  const source = (b.source ?? 'promo').toString().slice(0, 80)

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  }

  if (!emailConfigured()) {
    console.log('[demo-request] (Resend not configured) email:', email, 'source:', source)
    return NextResponse.json({ ok: true, emailed: false })
  }

  // Notify the team.
  await sendEmail({
    to: TEAM_TO,
    subject: `New demo request — ${email}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1c1917">
      <p>New "Run a community" demo request.</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Source:</strong> ${esc(source)}</p>
    </div>`,
    text: `New demo request.\nEmail: ${email}\nSource: ${source}`,
  })

  // Confirmation to the requester (best-effort — don't fail the request on this).
  await sendEmail({
    to: email,
    subject: 'Thanks — WhatsLocal will be in touch',
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1c1917">
      <p>Thanks for reaching out about running your community on WhatsLocal.</p>
      <p>We'll get back to you within a day.</p>
      <p>— The WhatsLocal team</p>
    </div>`,
    text: "Thanks for reaching out about running your community on WhatsLocal. We'll get back to you within a day.\n— The WhatsLocal team",
  })

  return NextResponse.json({ ok: true, emailed: true })
}
