# Marketplace Events — the webhook contract

Spec, 2026-09-23. Nothing is built yet. This document exists because **event
names are the one part that is expensive to get wrong**: the moment a vendor
points an automation at `order.paid`, that string is permanent. Everything else
here can be revised; the vocabulary cannot.

## What this is for

A vendor runs their own brand site and their own automations (n8n, Zapier, a
Claude agent of their own). They want the marketplace to *tell* them when
something happens — a sale, a booking request, a member joining — so their
tools can react. Later we offer an in-house builder; it runs on exactly these
events, so this is the substrate, not a detour.

---

## 1. The delivery trap, first

**`order.paid` is written in TWO places on purpose.** `app/api/checkout/confirm-payment`
writes the order when the browser comes back, and the `payment_intent.succeeded`
handler in `app/api/stripe-webhook` writes it too, so an order survives a
browser that closes mid-redirect. Both are idempotent against
`getOrderByPaymentIntent`.

Emit from each write site and every vendor's automation fires **twice on some
orders and once on others**, depending on whether the shopper's browser made it
back. Nondeterministic, invisible in testing, and impossible for the vendor to
debug. It would be the single worst bug this feature could ship with.

So:

> **Deliveries are keyed on the object's transition, not on the code path.**
> One delivery per `(member_id, event, object_id, object_version)`, deduped in
> the database with a unique index. A second emitter for the same transition is
> a no-op, not a second webhook.

`object_version` is whatever makes the transition unique — for an order that is
its `status`; for a membership its `status`; for a ticket `checked_in_at`. Not
`updated_at`, which changes for reasons nobody subscribed to.

This is the same discipline as `event_tickets`, where the order row is the
issuance lock, and as `shopper_lists`, where a unique index is what makes the
merge safe to re-run.

## 2. Where events are emitted from

There is no event bus today; the moments are scattered across a dozen route
handlers. There is, however, something very close to one: **`lib/notify.ts`**.
Every `notifyMemberUserSafe` call site is, by definition, a moment somebody
already decided was worth telling a human about. That list and this list should
stay close to each other.

The emit helper goes beside it — `lib/events.ts`, `emitEvent(...)` — and is
called from the same places, fire-and-forget, never awaited on a request path:

```ts
void emitEventSafe({ member_id, event: 'order.paid', object_id: order.id,
                     object_version: order.status, data: orderPayload(order) })
```

Never awaited, for the reason `notifyMemberUserSafe` isn't: a vendor's webhook
endpoint being slow must not make our checkout slow.

## 3. The events

The full set. Anything not on this list does not exist yet — resist adding one
per feature, because every name is permanent.

| Event | Fires when | Source |
|---|---|---|
| `order.paid` | A durable order row is first created | `confirm-payment` / `stripe-webhook` |
| `order.status_changed` | `paid → ready → dispatched → delivered \| refunded` | `app/api/vendor/orders` |
| `booking.requested` | Someone asks for a time | `app/api/bookings`, `app/api/voice/booking` |
| `booking.confirmed` | The vendor confirms (possibly a different time) | `app/api/bookings` |
| `membership.started` | A shopper's membership becomes active | `syncMembershipFromStripe` |
| `membership.cancelled` | It ends, or is set to end | `syncMembershipFromStripe` |
| `ticket.checked_in` | A QR is scanned at the door | `vendor/events/[id]/checkin` |
| `message.received` | A customer writes to the business | `vendor/messages`, `support` |
| `lead.captured` | The phone agent takes a name and number | `app/api/voice/lead` |
| `member.tagged` | The business is added to a tag | `app/api/tags` |

### Deliberately NOT events

- **Page views / "someone visited".** High volume, privacy-loaded, and already
  PostHog's job. Firing these at third-party endpoints is a lot of risk for
  very little signal, and it would dominate every delivery log.
- **"Filled out a form."** There is no forms feature. `lead.captured` is the
  nearest real thing. Add the event when the feature exists, not before.
- **Anything internal** — moderation verdicts, cache invalidations, embedding
  writes. A vendor subscribing to our plumbing is a vendor we can never refactor
  around.

## 4. Payload shape

One envelope, always the same:

```json
{
  "id": "evt_01JG...",
  "event": "order.paid",
  "created_at": "2026-09-23T21:04:11Z",
  "member_id": "89516919-256f-4a95-96df-fc9d285f664a",
  "data": { }
}
```

`data` carries a **stable projection**, never the raw row. The tables change;
the contract must not. Fields are chosen by what an automation needs, and
nothing more.

**`order.paid` / `order.status_changed`**
```json
{ "id", "order_number", "status", "items": [{ "name", "qty", "price_cents" }],
  "subtotal_cents", "discount_cents", "member_discount_percent",
  "fulfillment_type", "delivery_provider", "delivery_fee_charged_cents",
  "buyer_email", "event_id", "created_at" }
```
Deliberately absent: `payment_intent_id`, `platform_fee_cents`,
`vendor_amount_cents`, `delivery_address`, `uber_*`, `printify_order_id`.
A payment intent id is a credential for Stripe API calls; our fee split is our
business; a delivery address is the customer's. If a vendor needs the address
they can read it in the portal, where we know who is looking.

**`booking.requested` / `booking.confirmed`**
```json
{ "id", "service_name", "customer_name", "customer_email", "customer_phone",
  "requested_date", "requested_time", "alt_date", "alt_time", "note",
  "status", "confirmed_date", "confirmed_time" }
```
The customer's contact details ARE the point of this one — an automation that
can't reply to the person is useless.

**`membership.started` / `membership.cancelled`**
```json
{ "id", "plan_id", "status", "subscriber_email", "subscriber_name",
  "price_cents", "billing_interval", "current_period_end",
  "cancel_at_period_end", "started_at", "canceled_at" }
```
Absent: `stripe_subscription_id`, `stripe_customer_id` — same reason as above.

**`ticket.checked_in`**
```json
{ "id", "code", "event_id", "ticket_type_name", "buyer_name", "buyer_email",
  "checked_in_at" }
```
**Never `token`.** The token IS the credential — it is what the QR encodes and
what admits someone at the door. Putting it in a webhook payload posts the
equivalent of a ticket to a third-party server.

**`message.received`**
```json
{ "thread_id", "from_name", "preview", "received_at" }
```
A **preview**, not the body. The full text lives behind the portal, which
carries `data-private` for PostHog. Shipping customer conversations to an
arbitrary endpoint is a different privacy posture than storing them, and it
should be a deliberate opt-in if we ever offer it.

## 5. Guarantees

- **At least once.** Not exactly once — the dedup key prevents duplicate
  *transitions*, but a delivery may be retried if we never saw a 2xx. Consumers
  must be idempotent on `id`; the docs must say so in the first paragraph.
- **Order is not guaranteed.** `order.paid` and `order.status_changed` can land
  out of order. `created_at` is the tiebreaker.
- **Retries:** 5 attempts, exponential backoff (1m, 5m, 30m, 2h, 6h). After
  that the delivery is `failed` and visible in the log.
- **Timeout:** 10s. A slow endpoint is a failed delivery, not a slow checkout.
- **Auto-disable:** an endpoint failing every delivery for 24h is paused and
  the vendor is notified — via `notifyMemberUser`, push + email, like everything
  else.

## 6. Signing

Every request carries:

```
X-WhatsLocal-Event:      order.paid
X-WhatsLocal-Delivery:   dlv_01JG...
X-WhatsLocal-Timestamp:  1790200000
X-WhatsLocal-Signature:  sha256=<hex>
```

`HMAC-SHA256(secret, "{timestamp}.{raw body}")`. Timestamp in the signed string
so a captured payload can't be replayed later; consumers should reject anything
older than five minutes. The secret is shown **once** at creation and stored in
`vendor_secrets`, which is service-role only.

## 7. Tables

```sql
webhook_endpoints
  id, member_id, url, secret, events text[], active,
  failing_since timestamptz, created_at, updated_at

webhook_deliveries
  id, endpoint_id, member_id, event, object_id, object_version,
  payload jsonb, status ('pending'|'delivered'|'failed'),
  attempts, last_status_code, last_error, next_attempt_at,
  created_at, delivered_at
  UNIQUE (endpoint_id, event, object_id, object_version)   ← the trap in §1
```

Delivery runs on Trigger.dev, which already exists (`trigger/`) and already
handles scheduled work.

## 8. Tiering

**Pro.** It sits beside the AI agent and analytics — the things a business pays
for rather than the things that make selling free. Selling stays free; wiring
your own software into it is the paid surface.

Free vendors should see the tab with its event list and an upgrade prompt, not
a hidden feature. `EventsManager` learned this the hard way: a surface everyone
can reach must state its price.

## 9. Build order

1. **`lib/events.ts` + the two tables.** Emit from `order.paid` only, deliver to
   a single hardcoded test endpoint. This proves the dedup key against the real
   dual-write before anything else is built on it.
2. **The endpoint CRUD + delivery log** in the vendor portal. The log is not
   optional — without it, "my automation didn't fire" becomes a support ticket
   we cannot answer.
3. **The remaining events**, one at a time, each at its existing notify site.
4. **The in-house builder**, later: trigger → filter → action, where actions are
   our own primitives (send a message, email, apply a tag, issue a discount).
   It subscribes to the same event set, which is why this order is right.

## 10. Open questions

- **Does a vendor's agent need to write back?** Webhooks are one-way. Letting an
  agent reply to a message or advance an order needs per-vendor API tokens and
  a scoped action API — roughly twice this surface. Not decided.
- **Do we ever ship message bodies?** §4 says preview only. If vendors want
  their agent to draft replies, that changes, and it should change deliberately
  with a separate consent.
- **Test deliveries.** A "send me a sample" button is what makes this debuggable
  on the vendor's side. Almost certainly needed in step 2 rather than later.
