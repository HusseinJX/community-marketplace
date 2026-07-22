import { clerkClient } from '@clerk/nextjs/server'
import { sendPushToUser, notifyMember } from './push'
import { sendEmail } from './email'
import { getMemberContacts } from './event-comms'

// ─────────────────────────────────────────────────────────────────────────────
// THE notification strategy for this app.
//
// "Notify the user about X" ALWAYS means TWO channels, sent together:
//   1. Native APNs push  (lib/push.ts)   — the in-the-moment nudge on their phone
//   2. Email  (lib/email.ts, Resend)     — the durable record they'll still see later
//
// Push is ephemeral (missed if the phone's off / not installed / permission
// denied); email is the fallback that always lands. So every user-facing
// notification — invites, new messages, order/status updates, RSVPs, etc. —
// goes through here, NOT through sendPushToUser / sendEmail directly. Both
// channels no-op safely when unconfigured or when there's no device/address, so
// this is always safe to call and degrades gracefully.
//
// Wire call sites in later; this is the one primitive they all use.
// ─────────────────────────────────────────────────────────────────────────────

export interface Notification {
  title: string // push title + email subject
  body: string // push body + email body (plain text; a simple HTML wrapper is applied for email)
  url?: string // deep link — opened on push tap and as the email CTA (relative like "/vendor/network" or absolute)
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://whatslocal.ai'

function absolute(url?: string): string | undefined {
  if (!url) return undefined
  return url.startsWith('http') ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`
}

function emailHtml(n: Notification): string {
  const cta = n.url
    ? `<p style="margin:20px 0 0"><a href="${absolute(n.url)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600">Open WhatsLocal</a></p>`
    : ''
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1c1917;max-width:480px">
    <p style="margin:0 0 6px;font-size:18px;font-weight:600">${escape(n.title)}</p>
    <p style="margin:0;color:#57534e">${escape(n.body)}</p>
    ${cta}
    <p style="margin:24px 0 0;color:#a8a29e;font-size:13px">WhatsLocal AI · local businesses, together</p>
  </div>`
}

async function emailForClerkUser(clerkUserId: string): Promise<string | null> {
  try {
    const client = await clerkClient()
    const u = await client.users.getUser(clerkUserId)
    return u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null
  } catch {
    return null
  }
}

// Notify a Clerk user across BOTH channels. Returns what actually went out.
export async function notifyUser(
  clerkUserId: string,
  n: Notification
): Promise<{ pushed: number; emailed: boolean }> {
  const [pushed, email] = await Promise.all([
    sendPushToUser(clerkUserId, { title: n.title, body: n.body, url: n.url }),
    emailForClerkUser(clerkUserId),
  ])
  const emailed = email
    ? await sendEmail({ to: email, subject: n.title, html: emailHtml(n), text: n.body })
    : false
  return { pushed, emailed }
}

// Notify a business/organizer member across BOTH channels — bridges member_id →
// clerk devices (push) and member_id → contact email. Use for anything keyed by
// member (collab invites, room messages, event lineup invites, RSVPs).
export async function notifyMemberUser(
  memberId: string,
  n: Notification
): Promise<{ pushed: number; emailed: boolean }> {
  const [pushed, contacts] = await Promise.all([
    notifyMember(memberId, { title: n.title, body: n.body, url: n.url }),
    getMemberContacts([memberId]),
  ])
  const email = contacts[0]?.email ?? null
  const emailed = email
    ? await sendEmail({ to: email, subject: n.title, html: emailHtml(n), text: n.body })
    : false
  return { pushed, emailed }
}

// Fire-and-forget wrappers for request handlers: never throw, never block the
// response. In a route do `void notifyUserSafe(id, {...})`.
export async function notifyUserSafe(clerkUserId: string, n: Notification): Promise<void> {
  try {
    await notifyUser(clerkUserId, n)
  } catch {
    /* notifications are best-effort */
  }
}

export async function notifyMemberUserSafe(memberId: string, n: Notification): Promise<void> {
  try {
    await notifyMemberUser(memberId, n)
  } catch {
    /* notifications are best-effort */
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
