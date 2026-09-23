# Memberships — a marketplace, not a management tool

Spec, 2026-09-23 (rewritten the same day; §9 records what changed and why).
Nothing here is built. What exists today is §0.

## The offer

**We are another place to be found, and you pay only on what it produces.**

That has always been the pitch — a place to list your shop, your products, your
membership, and a promise that people will buy. The business changes nothing
about how it already operates. We are a customer acquisition channel that
happens to handle billing.

What we are NOT:

- **Not an aggregator.** We do not import memberships people hold elsewhere.
  You buy here, so it is here. That is the premise, not a limitation.
- **Not a replacement for their system.** A gym on Mindbody keeps Mindbody. We
  sell alongside it.
- **Not touching their existing customers.** Asking a business for its member
  list, in exchange for making those members easier to cancel, is a negative
  offer. There is no version of that worth building.

For a business with no system at all, ours **is** their system — plans, billing,
member list, redemption. Same product, different starting point.

## 0. What exists today

`membership_plans` (`name, description, price_cents, billing_interval,
discount_percent, perks jsonb, active, sort_order`) and `memberships`
(`plan_id, clerk_user_id, status, current_period_end, price_cents,
stripe_subscription_id, …`). Billing is a Stripe Connect destination charge,
5% of every renewal. `/shopper/memberships` lists what you hold, with renewal
date and cancel. `/memberships` browses what is for sale.

The gap is not completeness. It is that **`perks` is display-only text** — the
software enforces exactly one thing, `discount_percent`, applied to every item.
"Four studio sessions monthly" is a sentence nobody counts.

## 1. Everything sold here is real

Because we bill it, every membership in the wallet is verified by construction.
No trust ladder, no self-declared tier, no confirming people at a counter, no
reconciliation against a system we do not control.

This is the largest simplification available and it comes free with the
marketplace framing. See §9 for the draft that did it the hard way.

## 2. A member who moves here is new business

Someone cancels at the gym and re-subscribes through us. That is **new business
through this channel**, and it is chargeable.

- The business did not lose the customer. Only the rail changed.
- The customer chose it, because it was more convenient — which is value we
  created.
- No marketplace has ever priced on "only customers you did not already have".
  Shopify merchants pay on repeat buyers who could have phoned; Amazon sellers
  pay on people who already knew the brand. That is what a channel is.
- The business has an easy out at all times: do not list, or offer a better
  deal directly.

**The one line we hold:** generic consumer marketing, never a named business's
member base. "Manage your local memberships in one place", pointed at everyone,
is clean. Going after one gym's specific members would be a different act — and
we do not have their list, which is the same reason we never ask for it.

## 3. Pricing, and the order of it

**Percentage first.** "You pay nothing unless it works" is what gets the first
hundred businesses to yes with no meeting. A monthly fee inverts the risk: they
pay whether or not it produces, evaluate ROI monthly, and churn on the first
quiet one. Pre-liquidity that is fatal.

**Subscription later, and for the TOOLING rather than the sales** — which is
already the shape of the business: selling is free, 5% of what sells, Pro at
$30/mo for the AI agent and analytics (`lib/entitlements.ts`). Membership
tooling — redemption codes, credit tracking, member lists, campaigns — sits
naturally in Pro. Two revenue lines, and we never charge anyone for a channel
that has not yet worked for them.

## 4. Benefits that count

`discount_percent` becomes one row in a typed list. This is the change that
makes memberships generalise past "10% off".

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

- **`percent_off`** — what exists today. Optional `product_id` scopes it to one
  item rather than the basket: member pricing on classes but not on retail.
- **`free_item`** — a pastry with the coffee. Consumes a credit.
- **`credit`** — `value` per `period`. **The one that generalises**: a gym, a
  class pack and a coffee subscription are all credits with different labels.
- **`access`** — no money, just a yes. Member-only events, a door, early booking.

Migration is mechanical: every plan with `discount_percent > 0` becomes one
`percent_off` row, and each `perks[]` string becomes an `access` row with no
value — precisely what they are today, a promise, now typed as one.

`membership_plans.discount_percent` stays as checkout's fast path until benefits
ship, then becomes derived. **`memberDiscountPercent()` is its only reader**, so
there is exactly one place to change.

## 5. The credit ledger

Never a counter on a row. Grants and spends, like any balance:

```sql
membership_credits
  id, membership_id, benefit_id,
  delta integer,             -- +4 granted, -1 spent
  reason text,               -- 'grant' | 'redeem' | 'expiry' | 'adjust'
  redemption_id uuid,
  period_start date,         -- which cycle this grant belongs to
  created_at
```

Balance is `sum(delta)`. A mutable counter is how a member owed four sessions
has had five — two scanners at one door, one retry, and the number is wrong
with no way to find out when.

Credits are granted at the cycle boundary by the same Stripe webhook that
already advances `current_period_end`, keyed on `(membership_id, benefit_id,
period_start)` so a replayed webhook grants nothing twice. Unused credits expire
at cycle end by default — an `expiry` row, never a deletion, so history stays
readable.

## 6. Redemption

A listed membership is a monthly glance. A **used** one is weekly, and a used
one does not get cancelled. Using it means proving it at the counter — and that
machinery already exists: `event_tickets`, where the token is the credential,
plus the door scanner at `/vendor/checkin/[eventId]`.

```sql
membership_redemptions
  id, membership_id, member_id, benefit_id,
  code text,                 -- short, readable back across a counter
  redeemed_at, redeemed_by,
  created_at
```

Rules taken straight from ticketing, because they were learned there:

- **The token is the credential.** The wallet shows a rotating QR; staff see a
  short `code`. **The token never appears in a list** — the door guest list
  shows `code` and never `token`, because a leaked member list must not become
  a set of usable benefits.
- **The redemption row is the lock.** Two scans of one credit is one spend.
- **Staff see the outcome, not the balance.** "Yes — 3 sessions left after
  this" is the whole screen.

This is also what a business with no system of its own is actually buying: not
just billing, but the thing that works at the till.

## 7. What the shopper gets

The hero surface is **discovery**, not management. Nobody opens an app to
administer one membership; they open it to find what is out there.
`/memberships` leads, and the wallet is where it lands afterwards.

The wallet then gives what nothing else does — and all three are true precisely
because everything in it was bought here:

- **Every local membership you hold, in one place.**
- **What you have left** — "3 of 4 sessions" is the most-checked fact about any
  membership anyone holds, and checking it is what makes someone go.
- **What you spend locally each month**, across all of them.

"What you have left" is simultaneously the shopper's value and the business's
footfall. Same object. That is why it is worth building rather than merely
convenient.

## 8. Build order

1. **Typed benefits** — migrate `discount_percent` into a `percent_off` row;
   checkout reads benefits through the one existing reader.
2. **Credits + redemption**, reusing the ticket and scanner machinery.
3. **Wallet surfacing** — balances, monthly spend, Redeem.
4. **Campaigns**, once there is something worth pointing people at.

Before any of it: **`membership_plans` is empty.** Five good local memberships
are worth more than any feature in this document, and the canvass tool already
does that kind of walking-around work.

## 9. What changed in the rewrite, and why

The first draft had **linked memberships** — importing plans people hold
elsewhere, a three-level trust ladder, and confirming members at the counter.
Deleted, because it solved the wrong problem with a mechanism that would not
have been used: a `self_declared` membership could redeem nothing, so it was a
line of text a shopper had to type in for no payoff. The wallet would have
stayed empty anyway, and the ladder would have existed to serve it.

The marketplace framing removes the problem rather than solving it. Everything
sold here is billed, therefore verified, therefore redeemable.

The draft also hedged the promise to "the channel, not the novelty", on the
worry that a switching member is not really new. §2 settles it the other way:
they are new business through this channel, the business keeps the customer,
and no marketplace has ever priced otherwise.

## 10. Open questions

- **Do benefits ever apply to a counter sale?** A member buying in person, not
  through checkout. The scanner handles it, but our 5% never sees that sale —
  correct, and worth being deliberate about rather than discovering later.
- **Annual plans.** `billing_interval` supports `'year'`; credits with
  `period: 'month'` on an annual plan need the grant job to run monthly against
  a yearly cycle. Straightforward, not free.
- **Refunds and disputes.** A refunded membership with spent credits. Probably:
  credits stand, the row is marked, nobody claws back a pastry.
