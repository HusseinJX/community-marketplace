# App Store Resubmission Checklist

Rejection **b31380e8** (v1.0 build 3, reviewed Jul 27 2026). This tracks every
line of Apple's feedback → the fix → what's left. Code fixes are done, committed,
and build-verified; the remaining boxes are manual (App Store Connect, env, videos,
deploy). Work top to bottom.

**Code commits (branch `feat/collab-rooms`):**
- `39e40b8` park World Cup destination + shorts (5.2.1 / 2.1a)
- `228a311` StoreKit IAP (3.1.1 / 2.1b)
- `3897de2` UGC report/block + EULA + account deletion (1.2 / 5.1.1v)
- `942965b` Report/Block on home feed + scrub residual World Cup text

---

## Feedback → status

| Apple guideline | Fix (done in code) | Your action to close it |
|---|---|---|
| **5.2.1** FIFA/World Cup IP | Destination pages + hero hidden (404); Live kept; all "World Cup"/"FIFA" text scrubbed | ⬜ **Replace App Store screenshots + scrub description/keywords** (see A1) — *required, highest risk* |
| **2.1(a)** video didn't play | Shorts (placeholder-only, no playback) hidden | ⬜ Confirm Shorts was in build 1.0(3); if unsure see D-note |
| **2.1(b)** business model | StoreKit IAP built; reply drafted | ⬜ ASC IAP setup (A2) + sandbox-test (C3) + paste reply (E) |
| **1.2** UGC moderation | Report + Block (home feed & memories) + EULA + zero-tolerance terms + dev-notify + admin remove/ban | ⬜ Clerk legal URLs (B1) + `db push` (B3) + record videos (D) |
| **5.1.1(v)** account deletion | Surfaced on vendor dashboard (already on shopper) | ⬜ Record video (D) |
| **2.1** cookies/tracking | Verified pixels off; reply drafted | ⬜ Paste reply (E) + ensure App Privacy says "no tracking" (A4) |
| **2.1** NFC | Reply drafted (reads NDEF tags, no proprietary HW) | ⬜ Record video with a physical tag (D) |

---

## A. App Store Connect — listing & IAP

- ⬜ **A1. Remove World Cup from metadata.** Replace any screenshot showing
  "World Cup 2026"; remove "World Cup"/"FIFA" from the description, subtitle, and
  keywords. *(Apple explicitly required removing it from the app AND its metadata —
  the app is fixed; the listing is not.)*
- ⬜ **A2. Create the subscription products** (Features → In-App Purchases →
  auto-renewable), in one subscription group:
  - `ai.whatslocal.member.monthly` — Organizer, ~$9.99/mo
  - `ai.whatslocal.pro.monthly` — Pro, ~$29.99/mo
  *(Product IDs must match `lib/iap-products.ts` exactly.)*
- ⬜ **A3. Accept the Paid Applications agreement** + fill banking/tax (IAP won't
  work until this is "Active").
- ⬜ **A4. App Privacy → confirm no "Tracking"** is declared (matches the cookies
  reply). Do NOT enable the Meta/Google ad pixels for iOS until ATT is added
  (see NOTE at bottom).
- ⬜ **A5. Server Notifications V2 URL** (App Information → App Store Server
  Notifications, Production + Sandbox) → `https://whatslocal.ai/api/apple/notifications`
- ⬜ **A6. Note the numeric App Apple ID** (App Information) → set as env
  `APPLE_APP_APPLE_ID` (B2).

## B. Server / env / database

- ⬜ **B1. Clerk dashboard → set Terms + Privacy URLs** (`/terms`, `/privacy`) so
  the shopper Clerk sign-in modal shows the consent line. (VendorPhoneLogin already
  shows it in code.)
- ⬜ **B2. Env on CapRover:**
  - `APPLE_APP_APPLE_ID` = the numeric id from A6 (required for prod notifications)
  - `APPLE_IAP_BUNDLE_ID` = `ai.whatslocal.app` (optional; this is the default)
  - `MODERATION_EMAIL` = where report/block alerts go (defaults to hello@whatslocal.ai)
- ⬜ **B3. Apple root certs** — download the 4 from
  https://www.apple.com/certificateauthority/ into `certs/apple/` (public certs,
  safe to commit). Without them IAP verification fails closed (503).
- ⬜ **B4. `supabase db push`** — applies both new migrations:
  `20260729120000_apple_iap_subscriptions`, `20260729130000_ugc_moderation`.

## C. Xcode / native (whatslocal-ios)

- ⬜ **C1.** `npm install` then `npx cap sync ios` (regenerates the SPM package to
  include the new `whatslocal-iap` StoreKit plugin).
- ⬜ **C2.** Xcode → App target → Signing & Capabilities → **+ In-App Purchase**.
- ⬜ **C3.** Rebuild on a **physical device** and **test a purchase with a Sandbox
  Apple ID** — confirm it charges, unlocks Pro, and "Restore purchases" works.
  *(Do not resubmit until you've seen a purchase succeed.)*

## D. Videos to record (physical device, for the App Review notes)

- ⬜ **D1.** EULA/consent shown before login (open the login modal — the Terms line
  is under the Google/Apple buttons).
- ⬜ **D2.** Report a post (open a post → ⋯ → Report → pick a reason → it disappears).
- ⬜ **D3.** Block a user (open a post → ⋯ → Block → their content disappears).
- ⬜ **D4.** Account deletion (Profile/shopper OR vendor dashboard → Delete account →
  full flow to confirmation).
- ⬜ **D5.** NFC: scanning a physical NDEF tag opening a WhatsLocal profile.

> **D-note (2.1a):** The Shorts tab was placeholder-only (a Play button that played
> nothing) — almost certainly the "video section did not play" bug. Hiding it fixes
> it **if it was in build 1.0(3)**. If you're not sure, note in the reviewer notes
> that the non-functional video section has been removed. If they meant a different
> video surface (a live-broadcast embed or a post video), tell your engineer —
> YouTube video hosting is currently unconfigured, so uploaded video won't play.

## E. Paste the written replies

From `scratchpad/asc-replies.md` (this session) into the App Review reply / the
App Review Information notes:
- ⬜ **E1.** Cookies / tracking (2.1)
- ⬜ **E2.** Business model, 5 questions (2.1b)
- ⬜ **E3.** NFC clarification (2.1)

## F. Deploy & resubmit

- ⬜ **F1.** Build web → deploy to CapRover. **Gate check:** `curl -sI :3100/vendor`
  must be **307 → /vendor/sign-in** (a 200 = demo mode baked on — DO NOT SHIP).
- ⬜ **F2.** Confirm on prod: `/world-cup` → 404, home → 200, a post shows ⋯ →
  Report/Block, `/vendor` → 307.
- ⬜ **F3.** Upload the new native build (with IAP) to App Store Connect.
- ⬜ **F4.** Attach the demo account + the videos in App Review Information, paste
  the replies, and **Submit for Review**.

---

## NOTE — App Tracking Transparency (future, not for this submission)
The Meta/Google ad pixels are OFF (IDs unset), so the app does no tracking and the
cookies reply is truthful. **If you ever turn those pixels on for iOS**, you must
first add an ATT permission prompt (Capacitor:
`@capacitor-community/app-tracking-transparency`, fire pixels only on "Allow") AND
declare Tracking in App Privacy — otherwise it's a guaranteed rejection.

## What I could NOT verify (be aware)
- IAP has only been type/build-checked — it cannot run until A2/A3 + C1–C3 are done.
  **Sandbox-test before resubmitting.**
- Whether Shorts was in the rejected build (the video bug) — see D-note.
- Acceptance itself — App Review is judgment-based. This closes every line of the
  feedback; it does not guarantee the outcome.
