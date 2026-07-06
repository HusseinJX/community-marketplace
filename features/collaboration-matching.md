# Collaboration Matching — the Connective Tissue

How WhatsLocal turns its member graph into **real collaborations and events** across a
neighborhood. This is the "connective tissue" layer: it helps event organizers,
community organizations, and business-district programs (BIDs / CBDs like **Lower Polk**,
**Yerba Buena**) find the right partners, assemble lineups, and — over time — learn which
pairings actually produce events that happen and go well.

Nothing here is a research problem. It's a sequence of **clear, known upgrades** on top of
matching infra that already works. The moat isn't any single algorithm — it's the
**accumulated local outcome data** (which pairings in *this* district produced events that
ran and got good reviews). Nobody can copy that.

## Why the architecture fits this job

Collaboration matching is a *better* fit for this system than generic "find a business,"
because collaboration is inherently a **complementary + convening** problem, and that's
exactly what's built:

- **Complementary, not similar.** A market needs a baker + a coffee roaster + a muralist +
  a sponsor — not four similar people. The connector's `needs ↔ offers` bidirectional
  matching (`queryComplementary`) is the right shape. Most community directories only have
  similarity; this has complementarity.
- **The convener flow IS the organizer's workflow, encoded.** "Invent an event → figure
  out the roles it needs → fill each role from the local network" (`convener.js`
  invent-event / build-group / next-best) is literally what a BID does to activate a
  district. Shipped as **Auto-fill lineup** in `/vendor/organize`.
- **Local is the favorable regime.** Proximity, density, and observable outcomes all work
  *for* you in a bounded neighborhood, which is exactly where the go-to-market lives.

## Go-to-market makes the two hard problems go away

The only two things that decide "amazing vs. plausible" are **not technical**: local data
density and a closed outcome loop. The GTM neutralizes both by design:

- **District-by-district saturation.** Launch where activity already exists, partnered with
  the neighborhood's community organizer (Lower Polk, Yerba Buena, …). Density is local, so
  win one district at a time — not spray-and-pray across a city.
- **Highly motivated participants.** Vendors are eager: they give **rich onboarding** (the
  phone interview → full profile + embeddings), and actively **send/accept invites and run
  events**. That solves cold-start (rich vectors from day one) and closes the loop (events
  actually happen → outcomes exist to learn from).
- **A brand that pushes effort.** Participants are nudged to make profiles as rich as
  possible and to try hard to make collaborations work — so the loop compounds fast instead
  of plateauing.

Under these conditions, the compounding kicks in early and the technical upgrades below are
the only gating factor.

## Where it stands today (shipped)

- **Semantic match finder** (`components/match/MatchFinder` + `MatchCard`) wired into both
  collaboration surfaces, replacing name-substring filtering over a flat directory:
  - **Network** (`/vendor/network`) — "For you" (complementary) + NL search.
  - **Organize** (`/vendor/organize`) — role-scoped search + **Auto-fill lineup** (convener
    invents a themed event and fills each role from the local network).
- **Server proxy** `app/api/vendor/match` (resolveActor-gated) over the connector's
  matching engine; `lib/api.ts` normalizers (`searchMatches` / `similarMembers` /
  `matchObjective` / `complementaryFor` / `suggestLineup`).
- Results always show **fit breadcrumbs** ("they offer what you need ✓", "subcategory:
  Bakery") — the trust signal that makes people act on a match.

## The upgrade sequence

### Phase A — Close the outcome loop (the wire)
The marketplace collab network (Supabase) and the connector's learning ledger
(`matchLogs` / `matchFormats`) are currently **disconnected**: the invite→room→event path
creates no `matchLog`, so outcomes have nowhere to land. Fix = a **pair-keyed** bridge.

- **Connector:** new `marketplace-outcome.js` (bearer `CONNECTOR_ADMIN_TOKEN`, same pattern
  as `broadcasts/ingest` inbound). Body `{ memberA, memberB, stage, eventId?, ts }`. It
  `findOrCreateMatchLog(memberA, memberB)` → `recordOutcome(id, synthesized)` (mint the
  payload from `stage`, exactly like the existing `convenerOutcome()`), and at strong
  stages also `recordFormatWin()` from the pair's member types.
- **Marketplace:** `emitOutcome(...)` helper in `lib/api.ts` (a `postAdmin` sibling),
  called at the clean hook points below.
- **Idempotent** on `(pair, stage)`; store the highest stage reached.

**Label ladder — what to emit, from where:**

| Marketplace event | Emit point (existing hook) | `stage` | Label |
|---|---|---|---|
| Invite **declined** | `invites/[id]` PATCH | `declined` | negative |
| Invite **accepted** | `invites/[id]` PATCH | `accepted` | weak + |
| Both said **"I'm in"** | `rooms/[id]/members` PATCH | `committed` | + |
| Real back-and-forth (≥N msgs, ≥2 senders) | `rooms/[id]` POST (threshold) | `engaged` | + |
| Room **→ real event** | `rooms/[id]/event` POST | `event_planned` | **strong +** → format win |
| Event **ran** (past date + going>0) | batch/cron | `event_happened` | very strong + |
| Post-event **review** | net-new capture | `reviewed` | **gold** (signed +/−) |

Emit declines too — negatives are needed to learn, not just wins.

**Consumption (already exists, would light up immediately):** `loadSuccessfulMatches()`
feeds "these intros already worked, favor candidates like them" into the recommendation
blurb prompts (`recommend.js`); `matchFormats` win-counts feed `convener.js buildGroup`
(clone winning lineups) and per-member `formatAffinity`.

### Phase B — Ranking upgrades (proximity, recency, activity)
Add a **re-rank pass** after vector retrieval. All signals already exist:
- **Proximity** — `latitude`/`longitude` are in the Pinecone metadata; distance-weight.
- **Recency / activity** — `lastActiveAt` on the member; decay stale profiles.
- **Reciprocity / dedupe** — don't re-surface already-connected or already-declined pairs.

Known, standard signals — a scoring pass, not an invention.

### Phase C — Post-event review (the gold label)
Does not exist today (confirmed gap — no review table/route/lib). Net-new:
- A review capture (table + route) prompting **organizer + participants** after the event:
  did it happen, did people show, would you work together again, short note.
- Emit `stage: reviewed` with a signed label. This is the strongest training signal.

### Phase D — The re-ranker (the payoff)
Today the connector only re-*words* (biases LLM prose), it doesn't re-*rank* retrieval —
the code even references a "future re-ranker" that isn't built. Once outcomes accumulate,
build it: boost candidates whose feature-combination with the seeker resembles historically
successful pairs, learn per-district / per-category weights. **This is why the wire comes
first — you can't re-rank on data you aren't collecting.**

## Known seams / fixes to fold in
- **`sentiment` number-vs-string bug** — `extractOutcome` emits `sentiment` as a number
  (0–1) but `loadSuccessfulMatches` filters `sentiment === "positive"` (string), so most
  SMS/chat outcomes never count as successful. Emit the string from the synthesizer.
- **Room-proceed → matchLog gap** — a room voting to proceed increments a format win but
  never marks its originating `matchLogIds` complete. Phase A's endpoint handles this
  directly for the marketplace path.
- **Clerk-id vs member-id** — `event_attendees.attendee_id` is a Clerk id, not a connector
  member id, so RSVPs don't join to the collaborator pair. Attendance is an *event-health*
  signal; the pair-outcome is "the collab produced an event that ran" (host + lineup member
  ids, known at promotion time).
- **No `updated_at`** on `collab_*` tables — capture outcome timestamps at emit time in the
  route, not by reading the row back.

## What "working" looks like
- Organizers in a live district assemble lineups in minutes via Auto-fill, and **accept
  rate + room-activation + event-run rate climb** as profiles enrich.
- The outcome ledger fills with real `event_planned` / `event_happened` / `reviewed`
  signals, and match quality visibly improves district-over-district (the compounding).
- The system becomes the default way a BID/community org convenes its neighborhood — the
  connective tissue — because each activation makes the next one better.

## Design principles to protect
- **Propose, don't auto-invite.** Auto-fill *proposes* a lineup; the organizer *picks*.
  High-stakes district work wants curation. Keep the human in the loop.
- **Always show why.** The fit breadcrumbs are the trust layer — never surface a match
  without a reason.
- **Matching makes the introduction; humans make the collaboration.** The honest ceiling is
  "amazing at connections." The review loop is what lets the system learn the difference
  between a plausible match and one that actually works, and stop surfacing the fizzles.
