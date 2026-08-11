# The phone agent as a standalone product

*Written 2026-08-11. The demo lives at **https://answered-agent-demo.netlify.app**, source in
`~/Desktop/dev/answered`. This document is the thinking behind it: what the product would be, why
it can be pulled out of WhatsLocal cleanly, and what would have to be built if it ever became a
real company.*

---

## The observation

The inbound phone agent was built as a feature of WhatsLocal — a nice extra for businesses already
in the marketplace. But it does not depend on the marketplace in any meaningful way. It needs a
business's prices, hours and policies, and a phone number to answer. Nothing else.

That makes it separable, and arguably **more valuable separated**, because the marketplace's pitch
("join our directory") and the agent's pitch ("stop losing the calls you already get") appeal to
different instincts. The directory asks a business to believe in new demand. The agent points at
demand they are already paying for and losing.

## The pitch, in one line

> You are losing work to your voicemail.

Not "AI receptionist", not "conversational platform". Every small business owner has heard those.
What they have not heard is a number about their own phone. Most people who reach a voicemail hang
up and call the next business on the list; a large share of enquiries arrive outside working hours;
whoever answers first usually gets the job.

That framing matters commercially, and it is the same reasoning already recorded for the
marketplace's Nextdoor-adjacent segment: these owners are the most marketed-to small businesses in
America and are deeply cynical about "we'll bring you customers". **"Here's what the 9 callers you
missed last month wanted" is their own data, verifiable in a week, and requires believing nothing.**

## Why it is genuinely separable

| Needs | Where it comes from today | Standalone equivalent |
|---|---|---|
| Business knowledge | `buildBusinessContext()` — profile, catalog, events, owner FAQs | An onboarding form + a PDF drop + a website scrape |
| A number to answer | One shared Telnyx number + the diversion header | Identical — this is the whole trick |
| Somewhere for messages to land | `chat_conversations` / `chat_leads` | A simple inbox table |
| Bookings | `booking_requests` + optional Square | Identical |
| Notifications | `lib/notify.ts` (push + email) | Email alone until SMS registration clears |

The only genuinely marketplace-shaped dependency is *where the business's facts come from*. Everything
else — routing, tools, transcripts, tone-tuning — is already generic.

**The architectural fact that makes the business model work:** because a forwarded call carries the
originally-dialled number in a SIP Diversion header, **one phone number serves every customer**.
Onboarding a business is a routing-table row, not a number purchase. Gross margin per customer is
essentially the per-minute telephony and model cost, with no fixed per-line fee. See
`docs/phone-forwarding-by-carrier.md`.

## What the demo contains

Three screens, static-exported, no backend:

- **`/`** — the landing page. Hero with a real transcript (the product *is* a conversation, so
  showing the exchange beats describing it), the cost of a missed call, six capabilities, a
  three-step setup, pricing, and the FAQ every owner asks.
- **`/signup`** — a fake sign-up. No password field: asking a stranger to invent a password for a
  demo is pointless and teaches a bad habit.
- **`/app`** — the agent screen, copied from `app/vendor/assistant/` and rewired to local state:
  forwarding status, conversational tuner, enable/tone config, FAQ knowledge base with PDF drop,
  and the inbox of calls the agent answered.

The `/app` screen is deliberately near-identical to the real one, so it doubles as a spec.

### Two things the landing page says that most competitors hide

**The voicemail race.** Forwarding and the carrier's voicemail are two rules competing, and
whichever fires first wins. Set the delay too long and voicemail keeps winning while the phone
reports the forward as "Enabled". This is the single most likely support ticket, so it is on the
landing page rather than in a help doc discovered after purchase.

**What it will not do.** It never takes card details, never pretends to be human, and does not
record calls. Stating the limits up front is a trust play with an audience that has been sold to
badly for years — and each of those is a real constraint in the implementation, not marketing.

## What would have to be built for real

The demo is UI only. In rough order:

1. **Onboarding that fills the knowledge base without a marketplace profile.** The highest-value
   piece and the real differentiator: scrape their website and Google listing, let them correct it.
   "No setup wizard" is the advantage over Slang.ai and Rosie.
2. **Accounts, billing, and a real inbox.** Clerk + Stripe + a table; nothing novel.
3. **Number provisioning UI** — mostly guiding the vendor through their carrier's forwarding codes
   and verifying it took, which is a support problem more than an engineering one.
4. **SMS.** Blocked on carrier registration (10DLC / toll-free verification). Until it clears,
   email is the only outbound channel, and **no feature may be designed around texting a link.**
5. **Calendly, and per-business calendars.** Square works today. Raw Google Calendar does **not**
   suffice on its own — free/busy says when someone is *busy*, not when they are *bookable*; hours,
   duration, buffers, staff and lead time are all missing. That is a scheduling subsystem.

## What it would cost to run

Per answered call: telephony per-minute, speech-to-text, the model turns, and text-to-speech. The
business knowledge is stuffed into the prompt rather than retrieved, so there is no vector store to
run. At a $29/month price the constraint is **minutes per customer, not customers** — a business
with a genuinely busy phone is the expensive one, which argues for a fair-use cap rather than
"unlimited" once real usage is known.

## Honest status

The demo is a **showcase**, not a product. Nothing after sign-up is functional and nothing is
stored. The phone number on the page is the real WhatsLocal line, so calling it genuinely reaches a
working agent — which is the most persuasive thing on the site and costs nothing to offer.

Whether this should ever leave WhatsLocal is a separate question this document does not try to
answer. It only establishes that it *could*, and what that would take.
