# Memberships: the wallet, linked plans, and benefits that count

Spec, 2026-09-23. Nothing here is built. What exists today is in §0.

## The bet

People should manage **every local membership in one place** — the gym, the
coffee subscription, the climbing wall, the studio. Convenience drives opens;
opens drive sales. Businesses come for the storefront and stay because their
members are already here.

## 0. What exists today, honestly

`membership_plans` (`name, description, price_cents, billing_interval, discount_percent, perks jsonb, active, sort_order`)
and `memberships` (`plan_id, clerk_user_id, status, current_period_end, price_cents, stripe_subscription_id, …`).
Billing is a Stripe Connect destination charge with our 5% on every renewal.
`/shopper/memberships` lists what you hold, with renewal date and cancel.

Two things about that are load-bearing for this spec:

- **We only know about memberships we sold.** The wallet can never be complete,
  so "all your local memberships" is not something today's model can deliver.
- **`perks` is display-only text.** The software enforces exactly one thing:
  `discount_percent`, applied to all items. "Four studio sessions monthly" is a
  sentence nobody counts.

## 1. Two modes

> **You do not have to own the billing to own the wallet.**

| | **Sold here** | **Linked here** |
|---|---|---|
| Who bills | Us, via Stripe Connect | The business, wherever they already do |
| Our cut | 5% of every renewal | Nothing |
| Exists today | Yes | No |
| What it unlocks | Revenue | Everything else |

**Linked** is the wedge, and it is the answer to the question that kills
adoption: *a gym with 400 members on Mindbody will not move its billing to be
in an app.* With linked memberships it doesn't have to. Its members add what
they already hold, the gym gets a presence and a member list for free, and the
*next* member buys through us because one tap beats a signup form.

Sold is the revenue. Linked is what makes the wallet worth opening, and an
unopened wallet sells nothing.

## 2. The trust ladder

A linked membership is self-declared — anyone can claim to be a member. That is
fine for a wallet and not fine for a discount. So every membership carries a
`verification`:

| Level | How it got there | May redeem? |
|---|---|---|
| `self_declared` | The holder said so | **No** |
| `vendor_confirmed` | The business ticked them off their own list | Yes |
| `billed` | We charge the card, so we know | Yes |

Only `vendor_confirmed` and `billed` can spend a benefit. A `self_declared`
membership shows in the wallet, counts towards "you have 6 local memberships",
and buys nothing. The wallet is allowed to take your word for it; the till is
not.

Confirmation is a vendor action, not a document: `/vendor/memberships` grows a
"claimed by" list — *"7 people say they're members. Confirm the ones you
recognise."* That is a two-minute job for a business that already knows its
regulars, and it is how a linked membership becomes useful.

## 3. Benefits that count

`discount_percent` becomes one row in a typed list.

```sql
membership_benefits
  id, plan_id,
  kind text,          -- percent_off | free_item | credit | access
  label text,         -- what the card says
  value integer,      -- 10 (percent) · 4 (credits) · null
  product_id text,    -- free_item / access: which thing
  period text,        -- null | 'month' | 'cycle' — how often credits refill
  created_at, updated_at
```

- **`percent_off`** — what exists today. `value` is the percent. Optional
  `product_id` scopes it to one item instead of the whole basket, which is the
  "member pricing on classes but not on retail" case.
- **`free_item`** — a pastry with coffee. Consumes a credit.
- **`credit`** — `value` per `period`. Four studio sessions a month. **This is
  the one that makes memberships generalise**: a gym, a class pack and a coffee
  subscription are all credits with different labels.
- **`access`** — no money, just a yes. Member-only events, a door, early
  booking.

Migration is mechanical: every existing plan with `discount_percent > 0` becomes
one `percent_off` row; `perks[]` strings become `access` rows with no value,
which is exactly what they are today — a promise, now typed as one.

`membership_plans.discount_percent` stays as the cached fast path for checkout
until benefits ship, then becomes derived. **`memberDiscountPercent()` is the
only reader**, so there is one place to change.

## 4. The credit ledger

Never a counter on a row. Grants and spends, like any balance:

```sql
membership_credits
  id, membership_id, benefit_id,
  delta integer,             -- +4 granted, -1 spent
  reason text,               -- 'grant' | 'redeem' | 'expiry' | 'adjust'
  redemption_id uuid,        -- when it was a spend
  period_start date,         -- which cycle this grant belongs to
  created_at
```

Balance is `sum(delta)`. A mutable counter is how you get a member who is owed
four sessions and has had five — two scanners at one door, a retry, and the
number is wrong with no way to find out when.

Credits are granted on the cycle boundary by the same Stripe webhook that
already advances `current_period_end`, keyed on `(membership_id, benefit_id,
period_start)` so a replayed webhook grants nothing twice. Unused credits expire
at the cycle end by default — an `expiry` row, never a deletion, so the history
stays readable.

## 5. Redemption — the part that drives repeat visits

A listed membership is a monthly glance. A **used** one is weekly. Using it
means proving it at the counter, and **that machinery already exists**:
`event_tickets` where the token is the credential, plus the door scanner at
`/vendor/checkin/[eventId]`.

Same shape, reused deliberately:

```sql
membership_redemptions
  id, membership_id, member_id, benefit_id,
  code text,                 -- short, readable back over a counter
  redeemed_at, redeemed_by,  -- which staff member scanned it
  created_at
```

Rules taken straight from ticketing, because they were learned there:

- **The token is the credential.** The holder's wallet shows a rotating QR; the
  staff screen shows a short `code` they can read back. **The token never
  appears in a list**, exactly as the door guest list shows `code` and never
  `token` — a leaked member list must not become a set of usable benefits.
- **The redemption row is the lock.** Two scans of the same credit is one spend.
- **Staff see the outcome, not the balance**: "Yes — 3 sessions left after this"
  is the whole screen. A scanner that shows a wall of entitlements is a scanner
  nobody reads.

## 6. What the wallet becomes

`/shopper/memberships` today lists plan, business, price, renewal, cancel.
With the above it gains the things that make it worth opening weekly:

- **Everything, not just what we sold** — linked plans sit beside billed ones,
  with the weaker ones visibly weaker (no Redeem button on `self_declared`).
- **What you have left** — "3 of 4 sessions", the single most-checked fact
  about any membership anyone holds.
- **What you're spending locally, monthly**, across all of them. Nobody knows
  this number and everybody wants it. It is also, quietly, the strongest
  retention argument the app has.
- **Redeem** — the button that turns a list into a habit.

## 7. Build order

1. **Linked memberships + the trust ladder.** Completes the wallet, unblocks
   every existing membership business, and needs no new billing. Nothing else
   here is worth building if the wallet stays half-empty.
2. **Typed benefits**, with today's `discount_percent` migrated into a
   `percent_off` row and checkout reading benefits through the one existing
   reader.
3. **Credits + redemption**, reusing the ticket/scanner machinery.
4. **Wallet surfacing** — balances, monthly spend, Redeem.

## 8. Open questions

- **Does a linked membership ever become billed?** The obvious move once a
  business sees its members here is "bill through us instead" — one tap for the
  business, a re-entered card for every member. Probably a per-member offer at
  their next renewal rather than a migration.
- **Who confirms at a big business?** `vendor_confirmed` assumes someone knows
  the regulars. A 400-member gym needs a CSV of emails, not a list to tick.
- **Do benefits ever apply off-platform?** A member buying at the counter, not
  through checkout. The scanner handles it — but then our 5% never sees that
  sale, which is correct and worth being deliberate about.
- **Fraud on `self_declared`.** It buys nothing, so the exposure is a wallet
  that lies to its owner. Acceptable. It stops being acceptable the moment
  anyone proposes letting self-declared members redeem.
