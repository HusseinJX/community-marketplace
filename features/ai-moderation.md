# AI moderation

Built 2026-08-11. Proactive screening of user content — text **and images** —
on the write path, sitting in front of the reactive report/block stack that
already existed for App Store guideline 1.2.

## Why

The old stack only worked after the fact: a member reports a post, three
reports auto-hide it. That satisfies Apple, but it means the first handful of
people to see something objectionable *are* the filter, and images were never
inspected by anything at all.

## What runs, and what it costs

Two passes, in `lib/ai-moderation.ts`:

| Pass | Model | Covers | Cost |
| --- | --- | --- | --- |
| Safety | `omni-moderation-latest` | text + images, harm categories | **free** |
| Policy | `CHAT_MODEL` (gpt-4o-mini) | spam, scams, off-platform payment | ~$0.01 / 1k messages |

The safety pass is free, which is why it runs on **100% of writes** rather than
a sample. The policy pass costs money and is **off by default** — enable it
with `MODERATION_POLICY_CHECK=1`.

The two exist for different reasons and neither substitutes for the other: a
crypto-doubling scam scores ~0 on every safety category, and no threshold
tuning will ever surface it. That's the whole justification for a second pass.

## Three outcomes, not two

- **allow** — published normally.
- **review** — a model was unsure. A *post* is written hidden
  (`posts.moderation_status = 'pending'`, filtered out of every feed in
  `lib/posts.ts`) and the composer is told `pending: true`. A *chat message* is
  **delivered** and flagged: a collab room is a private 1:1, and holding a
  message mid-conversation over an unreviewed score is worse than logging it.
- **block** — never written. The member gets a plain refusal that names no
  category and no score; publishing the thresholds is publishing the way
  around them.

The gap between the review and block thresholds is the design. Automated
*hiding* is cheap to get wrong and trivial to undo; automated *deletion* is
neither.

## It fails OPEN

No key, an API error, a timeout — `screenContent` returns `allow` with a
`screener_unavailable:` reason. A screener outage must not become a posting
outage, and the reactive report path still covers whatever slips through. The
reason string is non-null on that path so the gap is visible in logs.

## Everything non-allow is logged

`moderation_events` stores the action, the categories, the **scores**, an
excerpt, the image count and whether an *image* (not just the text) tripped it.
Without the scores there is no way to tune a threshold except guessing, and no
answer to "why did my post disappear?" except a shrug.

Blocks email `MODERATION_EMAIL` immediately; holds accumulate quietly, which is
the point of holding rather than blocking.

## Where a human sees it

**/vendor/admin → Moderation** (`components/admin/ModerationQueue.tsx`) — this
is new; the admin moderation UI had been deferred since 2026-07-29, so held
content would otherwise have been invisible. Two separate lists, deliberately
not merged: a report is a person objecting, a screening event is a model
guessing. The queue joins held posts back to their images, because the thing
most likely to be objectionable is a photo the log only ever counted.

Held post → **Publish it** (`clear`) or **Keep hidden** (`uphold`).
Block or chat flag → **Agree** / **False positive** (`resolve`).

## Known gaps

- **Videos are not screened.** The moderation API takes images only, so a video
  post is still covered by the reactive path alone.
- Only two write paths are wired: `/api/posts` and collab room messages
  (`/api/vendor/rooms/[id]`). Product listings, member profiles and broadcast
  titles are not screened.
- `posts.moderation_status = 'pending'` hides a post from its author too — they
  are told it's under review, but they cannot see it.

## Files

- `lib/ai-moderation.ts` — the decision (pure, no DB)
- `lib/moderation.ts` — persistence, queue reads, moderator verdicts
- `supabase/migrations/20260811120000_ai_moderation.sql`
- `components/admin/ModerationQueue.tsx`, `app/api/admin/moderation/route.ts`
- `tests/ai-moderation.test.ts` — live tests; harmful inputs assert the exact
  verdict, ordinary ones only assert "not blocked" so threshold tweaks don't
  break the suite
