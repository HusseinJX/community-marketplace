# Selling on WhatsLocal — a setup guide

Everything below is live. Work through only the parts you need — each section says
what it's for, what plan it needs, and roughly how long it takes.

**Where things live:** sign in at [whatslocal.ai](https://whatslocal.ai) → **Business
login**. That's your dashboard. Most setup happens under **Integrations**.

---

## First: which plan do you need?

| You want to… | Plan |
|---|---|
| Have a profile, post, be found | **Free** |
| Host events, sell tickets, take bookings | **Organizer** — $10/mo |
| Sell anything (products, downloads, merch), take card payments | **Pro** — $30/mo |

If a button described here isn't showing up for you, it's almost always the plan.
Upgrade under **Billing**.

---

## 1. Get paid — do this first

**Needs:** Pro · **Takes:** ~10 minutes · **Required for:** every paid thing on this page

Nothing that takes money works until this is done, so start here.

1. Dashboard → **Integrations** → **Bank**
2. Click **Set up payments**. You'll be handed to Stripe.
3. Fill in your business details, bank account and ID. Stripe asks for these, not us —
   they're the ones moving the money.
4. Come back when Stripe sends you to us. The card should say **Active**.

**What it costs you:** we take **5% of the items you sell**. Delivery and postage are
never counted in that — you keep those in full. Stripe takes their own processing fee
on top, same as anywhere.

**If it says "pending":** Stripe is still reviewing, usually a day or so. You can set
everything else up meanwhile; you just can't take money yet.

---

## 2. Sell tickets to your events

**Needs:** Organizer (to host events) · **Takes:** ~5 minutes · Paid tickets also need §1

### Set it up
1. Dashboard → **My events** → open your event (or create one)
2. Open the **Tickets** tab
3. **Add a ticket tier** — give it a name, a price, and how many exist
   - Price **0** makes it free. Free tickets still get a scannable code, so you can
     still count people at the door.
   - Leave the quantity blank for unlimited
4. That's it. The Book/ticket box appears on your event page straight away.

### Check people in on the night
1. Dashboard → **My events** → your event → **Tickets** → **Check in at the door**
   (or go straight to it on your phone)
2. Point the camera at their QR code

The screen goes **green** for admitted, **red** for a problem, big enough to read at
arm's length. If someone's phone is dead, type the short code from their email, or
search their name in the box underneath.

**A ticket that's already been scanned will be refused.** That's deliberate — it's what
stops one screenshot getting five people in. It'll tell you when it was first used.

### Worth knowing
- Customers **don't need an account**. They get their ticket by email.
- If they sign in later with the same email, their tickets appear under **My tickets**.
- Refunding a ticket in Stripe stops it working at the door automatically.

---

## 3. Choose how orders reach people

**Needs:** Pro · **Takes:** ~3 minutes

Dashboard → **Integrations** → **Delivery**. Pick one:

**Pickup only** — customers collect from you. Just add your address.

**I deliver it myself** — you drive. You set the rules and **you keep the delivery fee
in full**:
- **Delivery fee** — what you charge
- **Free over** — orders above this amount get free delivery (leave blank for never)
- **Minimum order** — below this, delivery isn't offered (they can still collect)
- **ZIP codes you cover** — **leave blank to deliver anywhere.** Only fill this in if
  you want to be strict about your area
- **When you deliver** — free text, e.g. "Tuesday & Thursday evenings". Customers see
  this before they pay

**Uber courier** — not available yet. We're still finishing the account setup with
Uber. It'll appear on its own when it's ready.

Customers see your terms *before* they type an address, so nobody gets surprised by a
fee at the last step.

---

## 4. Add what you're selling

**Needs:** Pro · **Takes:** ~2 minutes per item

Dashboard → **Products** → **Add product**. Give it a name, a price, and pick what
kind of thing it is. **This matters** — it decides what the customer is told happens
next:

- **Physical item** — they collect it or you deliver it
- **Service** — something you do for them. No pickup, no delivery; they're told you'll
  be in touch to arrange it
- **Digital download** — see §5

Getting this right is why a haircut no longer tells the customer to "pick up" their
appointment.

**Shortcut:** you can photograph a menu, a flyer or your counter and we'll draft the
products for you — **Scan menu** on the same page. They land as drafts for you to
check before anything goes live.

---

## 5. Sell digital downloads

**Needs:** Pro · **Takes:** ~2 minutes per file

Recipes, guides, presets, music, artwork — anything that's a file.

1. **Products** → **Add product** → choose **Digital download**
2. Attach the file (up to 200MB)
3. Set a price and save

When someone buys it, the download link is emailed to them immediately. No account
needed, and the link keeps working — people replace phones.

**Your file stays private.** Buyers never get a link to the file itself, only a link
that checks they paid and then lets them download. It can't be shared by copying a URL
out of the email.

---

## 6. Sell merch without holding stock (Printify)

**Needs:** Pro + a Printify account · **Takes:** ~10 minutes

T-shirts, mugs, prints — Printify makes each item when it's ordered and posts it.

1. In **Printify**: My Profile → Connections → **Generate token**
2. Here: **Integrations** → **Print on demand** → paste the token → **Connect**
3. Click **Import products**

Your designs arrive as **drafts** under Products. Nothing goes on sale until you
approve it — check the prices first.

**How the money works:** the customer pays you for the item plus postage. Printify
bills you for printing and postage. So the postage they pay comes to **you**, in full.

**Postage** is worked out from the customer's real address at checkout, so you're never
out of pocket on it. Print-on-demand items are always posted — pickup isn't offered for
them, because Printify ships them directly.

**Disconnecting** leaves your imported products alone. They just stop syncing.

> This one is brand new and you'd be our first vendor on it. Tell us how the first
> import goes.

---

## 7. Take bookings

**Needs:** nothing extra to start · **Takes:** 0 minutes

**This already works.** The **Book** button on your profile is on by default.

A customer suggests a day and a rough time ("Thursday afternoon"), and you get a push
notification and an email. Then:

1. Dashboard → **Bookings**
2. Requests needing an answer are always at the top
3. **Confirm**, **Suggest another time**, or **Can't make it**

"Suggest another time" is the useful one — *"not Thursday, but Friday at 2 works"* is
what people actually say. The customer gets emailed either way. Nothing is booked until
you say yes.

### Optional: show your real availability (Square Appointments)

If you already run **Square Appointments**, customers can see your genuinely open slots
and book instantly instead of asking.

1. In **Square**: create an access token with these four permissions —
   **Appointments read**, **Appointments write**, **Items read**, **Customers write**
2. Here: **Integrations** → **Square Appointments** → paste it → **Connect**

⚠️ **If you've already connected Square for your product catalog, that token won't
work here.** It doesn't have the appointments permissions. You need a new one with all
four above.

Once connected, your bookable services show up and customers book real slots directly.
Cancelling or declining here frees the slot in Square too.

> Also brand new. If anything looks wrong, disconnect — you'll drop straight back to
> the ask-and-confirm flow, which always works.

---

## Quick reference

| Feature | Where | Plan | Needs payments set up? |
|---|---|---|---|
| Get paid | Integrations → Bank | Pro | — |
| Event tickets | My events → Tickets | Organizer | Only for paid tickets |
| Door check-in | My events → Check in at the door | Organizer | No |
| Delivery rules | Integrations → Delivery | Pro | Yes |
| Products | Products | Pro | Yes |
| Digital downloads | Products → Digital download | Pro | Yes |
| Print on demand | Integrations → Print on demand | Pro | Yes |
| Bookings | Bookings | Free | No |
| Real availability | Integrations → Square Appointments | Pro | No |

---

## If something isn't working

- **A button is missing** → almost always your plan. Check **Billing**.
- **"This vendor hasn't set up payments"** → §1 isn't finished, or Stripe is still
  reviewing.
- **Tickets won't sell** → paid tickets need payments active. Free tiers work
  regardless.
- **Square won't connect** → wrong token. It needs all four permissions in §7.
- **A customer says they didn't get their ticket or download** → have them check spam,
  then tell us the email they used and we can resend.

Anything else — **Send feedback** at the bottom of any page, and it reaches us with the
context attached.
