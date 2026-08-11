import 'server-only'
import type OpenAI from 'openai'
import { getOpenAI, CHAT_MODEL } from './openai'

// Proactive AI screening for user-written content — text AND images.
//
// lib/moderation.ts is the REACTIVE half (a human reports, three reports hide a
// post). This is the pre-publish half: every post and chat message goes through
// a model before it lands, so the community isn't the filter of first resort.
//
// The screener is `omni-moderation-latest`, which takes text and image URLs in
// one call and is FREE — proactive moderation costs nothing per item, which is
// why it can run on 100% of writes rather than a sample. The optional second
// pass (policyCheck) is the part that costs money; it is off by default.
//
// This module is deliberately pure: it decides, it does not write. Persistence
// and the moderator queue live in lib/moderation.ts, which already owns the
// service-role client.

export type ModerationAction = 'allow' | 'review' | 'block'

export interface ScreenResult {
  action: ModerationAction
  /** Category names that crossed a threshold, worst first. */
  categories: string[]
  /** Every non-trivial score, for the audit log — this is what makes a decision reviewable. */
  scores: Record<string, number>
  /** True when an IMAGE tripped it, not just the text. A clean caption on a bad photo is the common case. */
  flaggedImages: boolean
  /** Short human-readable explanation, safe to show a moderator (never the member). */
  reason: string | null
}

const ALLOW: ScreenResult = { action: 'allow', categories: [], scores: {}, flaggedImages: false, reason: null }

// Categories that end the conversation on their own, at any confidence the
// model is willing to flag. There is no gray band worth preserving here.
const ZERO_TOLERANCE = new Set(['sexual/minors'])

// Block thresholds per category. Lower number = less tolerance. The
// "/threatening", "/violent" and "/instructions" variants sit lower than their
// parents on purpose: "I hate mondays" and "I will find where you live" both
// land in `hate`-adjacent space, and only one of them is a safety problem.
const BLOCK_AT: Record<string, number> = {
  sexual: 0.85,
  hate: 0.9,
  'hate/threatening': 0.7,
  harassment: 0.92,
  'harassment/threatening': 0.7,
  illicit: 0.9,
  'illicit/violent': 0.7,
  'self-harm': 0.9,
  'self-harm/intent': 0.8,
  'self-harm/instructions': 0.7,
  violence: 0.92,
  'violence/graphic': 0.85,
}

// Anything above this but below its block threshold is held for a human. The
// gap between the two numbers is the whole design: automated *hiding* is cheap
// to get wrong and easy to undo, automated *deletion* is neither.
const REVIEW_AT = 0.4

// Scores below this are noise and would bloat every log row.
const LOG_FLOOR = 0.05

// Images per item actually sent to the screener. Free per call, but each image
// is a fetch the API performs before it can answer, so an unbounded carousel
// would stall the write. Six covers every real post; the rest are logged as
// unscreened rather than silently treated as clean.
const MAX_IMAGES = 6

/** Only absolute http(s) URLs are fetchable by the API — data: and relative paths are not. */
function screenableImages(urls: string[] | undefined): string[] {
  return (urls ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, MAX_IMAGES)
}

/**
 * Screen one piece of user content.
 *
 * FAILS OPEN. If the key is missing or the API errors, this returns `allow`
 * with a reason — it does not hold the write. That is a deliberate trade: a
 * screener outage would otherwise either block every post on the platform or
 * dump every post into a review queue nobody can drain, and the reactive
 * report/block path still covers anything that slips through. The reason
 * string is non-null on that path so the caller can log the gap.
 */
export async function screenContent(args: {
  text?: string | null
  imageUrls?: string[]
}): Promise<ScreenResult> {
  const text = (args.text ?? '').trim()
  const images = screenableImages(args.imageUrls)
  if (!text && images.length === 0) return ALLOW
  if (!process.env.OPENAI_API_KEY) return { ...ALLOW, reason: 'screener_unavailable: no OPENAI_API_KEY' }

  const input: OpenAI.ModerationMultiModalInput[] = []
  if (text) input.push({ type: 'text', text })
  for (const url of images) input.push({ type: 'image_url', image_url: { url } })

  try {
    const res = await getOpenAI().moderations.create({ model: 'omni-moderation-latest', input })
    const r = res.results?.[0]
    if (!r) return { ...ALLOW, reason: 'screener_unavailable: empty result' }

    const rawScores = (r.category_scores ?? {}) as unknown as Record<string, number>
    const applied = (r.category_applied_input_types ?? {}) as unknown as Record<string, string[]>

    const scores: Record<string, number> = {}
    for (const [k, v] of Object.entries(rawScores)) {
      if (typeof v === 'number' && v >= LOG_FLOOR) scores[k] = Math.round(v * 1000) / 1000
    }

    const blocking: string[] = []
    const reviewing: string[] = []
    for (const [category, score] of Object.entries(rawScores)) {
      if (typeof score !== 'number') continue
      const flagged = (r.categories as unknown as Record<string, boolean>)?.[category] === true
      if (ZERO_TOLERANCE.has(category) && (flagged || score >= REVIEW_AT)) {
        blocking.push(category)
      } else if (score >= (BLOCK_AT[category] ?? 1.01)) {
        blocking.push(category)
      } else if (score >= REVIEW_AT || (flagged && score >= LOG_FLOOR)) {
        reviewing.push(category)
      }
    }

    const hit = (blocking.length ? blocking : reviewing).sort(
      (a, b) => (rawScores[b] ?? 0) - (rawScores[a] ?? 0),
    )
    // An image is implicated when any tripped category was applied to an image.
    const flaggedImages = hit.some((c) => (applied[c] ?? []).includes('image'))

    if (blocking.length) {
      return { action: 'block', categories: hit, scores, flaggedImages, reason: `blocked: ${hit.join(', ')}` }
    }
    if (reviewing.length) {
      return { action: 'review', categories: hit, scores, flaggedImages, reason: `held: ${hit.join(', ')}` }
    }
    return { ...ALLOW, scores }
  } catch (err) {
    // Never let a screener fault become a posting outage.
    const message = err instanceof Error ? err.message : 'unknown error'
    return { ...ALLOW, reason: `screener_unavailable: ${message}` }
  }
}

// ── Optional second pass: community policy ──────────────────────────────────
//
// omni-moderation answers "is this harmful?" — it has no opinion on the thing
// a neighbourhood marketplace actually drowns in, which is spam, crypto pitches
// and off-platform payment scams. Those score ~0 on every safety category, so
// no threshold tuning will ever surface them; it takes a model that knows the
// house rules.
//
// This runs on EVERY item when enabled, because a scam is invisible to the
// first pass and so cannot be gated behind its gray band. That is why it is
// off by default: gpt-4o-mini is roughly $0.01 per thousand short messages —
// cheap, but not free like the pass above. Turn it on with MODERATION_POLICY_CHECK=1.

const POLICY_PROMPT = `You screen posts and messages for a neighbourhood marketplace where local
businesses and residents organise events and sell to each other.

Return "block" ONLY for: payment or crypto scams, phishing, stolen goods,
bulk unsolicited advertising for unrelated off-platform products, or attempts
to move a transaction off-platform to avoid buyer protection.

Return "review" for: plausible-but-unclear solicitation, unverifiable medical
or financial claims, or content that reads as a bot.

Return "allow" for everything else. A local business promoting its OWN event,
product or service is the point of this platform — that is always "allow".
Ordinary rudeness is not a policy matter; safety is handled elsewhere.

Answer with JSON only: {"action":"allow"|"review"|"block","reason":"<8 words max>"}`

export function policyCheckEnabled(): boolean {
  return process.env.MODERATION_POLICY_CHECK === '1' && !!process.env.OPENAI_API_KEY
}

/** Spam/scam pass. Fails open exactly like screenContent, and never escalates past 'review' without a reason. */
export async function policyCheck(text: string): Promise<ScreenResult> {
  const body = text.trim()
  if (!body || !policyCheckEnabled()) return ALLOW
  try {
    const res = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      max_tokens: 60,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: POLICY_PROMPT },
        { role: 'user', content: body.slice(0, 4000) },
      ],
    })
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
      action?: string
      reason?: string
    }
    const action: ModerationAction =
      parsed.action === 'block' ? 'block' : parsed.action === 'review' ? 'review' : 'allow'
    if (action === 'allow') return ALLOW
    return {
      action,
      categories: ['policy/spam'],
      scores: {},
      flaggedImages: false,
      reason: `policy ${action}: ${(parsed.reason ?? '').slice(0, 120) || 'unspecified'}`,
    }
  } catch {
    return ALLOW
  }
}

/** Both passes, worst verdict wins. This is what callers should use. */
export async function screen(args: { text?: string | null; imageUrls?: string[] }): Promise<ScreenResult> {
  const text = (args.text ?? '').trim()
  const [safety, policy] = await Promise.all([
    screenContent(args),
    text ? policyCheck(text) : Promise.resolve(ALLOW),
  ])
  const rank: Record<ModerationAction, number> = { allow: 0, review: 1, block: 2 }
  if (rank[policy.action] > rank[safety.action]) {
    // Keep the safety scores on the row even when policy is the reason it stopped —
    // the log should show everything that was known at decision time.
    return { ...policy, scores: { ...safety.scores }, flaggedImages: safety.flaggedImages }
  }
  if (safety.action === 'allow' && policy.action === 'allow') {
    return { ...safety, reason: safety.reason ?? policy.reason }
  }
  return safety
}
