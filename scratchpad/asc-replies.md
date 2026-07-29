# App Review — written replies (resubmission b31380e8)

Rewritten 2026-07-29 for the IAP-shipping build.

## Where each piece goes in App Store Connect

- **Reviewer NOTES block** (native capabilities + demo account + IAP + moderation +
  deletion — the big block drafted separately): App Store Connect → your app →
  the version → scroll to **App Review Information → Notes**. Put the Google demo
  login (email/password) in this Notes field too, since "Sign in with Google"
  can't go in the standard username/password fields.
- **These Q&A replies (E1/E2/E3):** post in the **Resolution Center** — the message
  thread on the rejected submission — as your reply, since that's where Apple asked
  the questions. Lead with the 2-line summary below, then paste E1, E2, E3.
  (Optional: also append them to App Review Information → Notes so the new reviewer
  sees them proactively.)

### Resolution Center summary line (paste first)
> Thank you for the review. This build resolves every item: all "World Cup"/"FIFA"
> references have been removed from the app **and** its metadata; digital
> subscriptions are now sold via StoreKit in-app purchase; and we added user
> reporting, user blocking, an EULA, and in-app account deletion. Point-by-point
> answers follow.

---

## Reviewer NOTES block (App Review Information → Notes)

Put the Google demo login in this field too (Sign in with Google can't go in the
standard username/password fields). Only ship the IN-APP PURCHASES paragraph if
the build actually shows a reachable StoreKit purchase screen + you've seen a
sandbox purchase succeed; otherwise drop it.

```
WhatsLocal AI is a native iOS app for local-community discovery and business networking. It is NOT just a website wrapper — it uses device capabilities that only work natively:

• PUSH NOTIFICATIONS (APNs) — businesses are notified in real time when they receive a collaboration invite, a message in a collab room, or an event RSVP. These are real APNs pushes sent from our own server (no third-party push SDK).
• CAMERA QR SCANNING — scan a business/event QR code to open it in-app.
• NFC TAG READING — tap a standard NDEF tag to open a WhatsLocal profile. We read standard NDEF tags only; no proprietary hardware.
• LOCATION — the map and "what's live near me" use device location.

NO LOGIN REQUIRED TO REVIEW THE APP. Shoppers browse everything — the map, businesses, events, and live "what's near me" — with no account. Please review the app this way first; account creation is optional (used only for saving, invites, RSVPs, and business claiming).

OPTIONAL — to also see the gated business/vendor tools, a demo account is provided:
  Sign-in: tap "Continue with Google" and use this account (2-factor is off so you can sign in):
  Email: whatslocalreview@gmail.com
  Password: Reviewtest26
This demo account is already on the Pro plan, so you can see all paid business tools without making a purchase. Signed in, the business portal shows: profile, posting, events, and the collaboration network (invite → shared chat → organize an event lineup).

IN-APP PURCHASES (StoreKit): The app offers two auto-renewable subscriptions, purchased in-app through StoreKit — "Organizer" (~$9.99/mo) and "Pro" (~$29.99/mo). They unlock additional tools for businesses/organizers (Organizer: send collaboration invites and host events; Pro: adds commerce and the AI business agent). All discovery and shopper features are free and require no purchase.

USER-GENERATED CONTENT & MODERATION (guideline 1.2): Users accept an EULA (zero tolerance for objectionable content) at account creation. Any post can be reported, or its author blocked, from the "•••" menu on a post — on the home feed and in the memories gallery. Reported or blocked content is filtered from the feed immediately; our team reviews reports and can remove content or ban authors.

ACCOUNT DELETION is available in-app under "Profile → Account → Delete account" (and at https://whatslocal.ai/support).
```

---

## E1 — 2.1 Cookies / Tracking

Thank you for the question about cookies and tracking.

- The cookie notice you saw is a standard **web** consent banner shown in our web experience. It lets a user accept or decline optional analytics/advertising cookies on the website.
- The iOS app does **not** track users in the sense defined by App Tracking Transparency. It does not link user or device data with third parties for advertising, does not share data with data brokers, and does not use the advertising identifier (IDFA).
- **Third-party advertising pixels are not enabled** in the app (no Meta/Facebook or Google Ads tags are active).
- The only analytics we use is **first-party** product analytics, used solely to understand usage of our own app. It is not used to track users across other companies' apps or websites.
- Because no tracking (as Apple defines it) occurs, the app shows **no App Tracking Transparency prompt**, and our **App Privacy** information declares that we do **not** use data for Tracking. This is accurate for the submitted build.

---

## E2 — 2.1(b) Business Model / In-App Purchases

Thank you for the questions about our business model. Here is exactly how WhatsLocal AI works.

**1) Who uses the paid features?**
Local business owners and event organizers. Everyday users ("shoppers") never pay — all discovery, browsing, the map, events, live "what's near me," and the AI concierge are free and require no account.

**2) What do the paid subscriptions unlock, and are they auto-renewable?**
Two auto-renewable subscriptions, sold in-app through StoreKit:
- **Organizer — US$9.99/month:** lets a business send collaboration invites to other local businesses and create/host events (invite and message a vendor lineup).
- **Pro — US$29.99/month:** everything in Organizer, plus storefront/commerce tools and an AI business assistant.
Both unlock software features used inside the app, so they are offered as in-app purchases (StoreKit).

**3) Where can the subscriptions be purchased?**
Inside the iOS app, via StoreKit in-app purchase. The iOS app contains no link, button, or call to action to buy or manage a subscription anywhere outside the app.

**4) Can a user access a subscription they purchased on another platform?**
Yes. WhatsLocal AI is also a website (whatslocal.ai). A business that subscribes on the web can sign in to the iOS app and use the plan it already has, and the reverse is also true (a multiplatform service, per guideline 3.1.3(b)). The iOS app sells the same plans directly via in-app purchase.

**5) Does the app use any payment method other than in-app purchase — and if so, for what?**
Only for physical goods and real-world services — never for digital or software features. The "Pro" storefront lets a local business sell physical products (e.g. food, retail items) and real-world services to shoppers, with optional local delivery. Because these are physical goods and services consumed in the real world (not digital content used within the app), they are processed with a standard payment provider (Stripe), consistent with guideline 3.1.5(a) (goods and services consumed outside the app). All digital/software subscriptions use in-app purchase.

**In short:** digital software features = StoreKit in-app purchase; physical goods and services from local businesses = Stripe (real-world goods, 3.1.5(a)).

---

## E3 — 2.1 NFC clarification

Thank you for the question about our use of NFC.

WhatsLocal AI uses Core NFC to let a user read a **standard NDEF tag** placed by a local business or event — for example, a sticker in a shop window or a card on a table. The tag contains a WhatsLocal URL; when the user taps it, the app opens that business or event profile in the app.

- It reads **standard NDEF tags only**.
- It uses **no proprietary hardware or protocol**, and does **not** read contactless payment cards or secure elements.
- It does **not** write to tags.
- It is **user-initiated and optional** — the app is fully usable without NFC. The same profiles are reachable by search, the map, or camera QR scan.
