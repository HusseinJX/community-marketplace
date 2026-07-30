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

## Progress — updated 2026-07-29 (resume here)

**DONE this session:**
- ✅ New App Store screenshots (5, framed, 1320×2868) → `~/Desktop/whatslocal-appstore-screenshots/` (A1 image half). Description/keywords scrub in ASC still TODO.
- ✅ `supabase db push` — moderation + IAP migrations live (B4).
- ✅ Apple root certs downloaded → `certs/apple/` + Dockerfile `COPY certs`; deployed (B3).
- ✅ Paid Apps agreement **Active** (A3).
- ✅ Both subscriptions created in ASC → "Ready to Submit" (A2): `ai.whatslocal.member.monthly` (Organizer $9.99), `ai.whatslocal.pro.monthly` (Pro $29.99).
- ✅ `npx cap sync ios` (whatslocal-iap StoreKit plugin in the build) (C1) + Xcode In-App Purchase capability added (C2). App runs on device.
- ✅ Reviewer NOTES block + E1/E2/E3 replies written → `scratchpad/asc-replies.md`.
- ✅ Web deployed to CapRover + verified (F1/F2): `/vendor`→307, World Cup→404, moderation route live.
- ✅ Prod fixes: admin demo is now dev-only (no cookie opens the portal in prod); vendor-portal mobile layout (padding/back button via VendorChrome); signed-in vendor → dashboard from Profile.

- ✅ **C3 sandbox purchase VERIFIED end-to-end** (2026-07-29): StoreKit buy → server
  verifies against Apple → Pro unlocks. Two bugs found + fixed:
  1. The DER `.cer` cert files were corrupted going through the tar/Docker/Next-trace
     pipeline (`ERR_OSSL_PEM_NO_START_LINE`). Certs are now **EMBEDDED as PEM strings
     in `lib/apple-root-cas.ts`** (read from code, not disk) so nothing can corrupt them.
  2. The production verifier throws without `APPLE_APP_APPLE_ID` → **set on CapRover =
     `6793615366`** (also closes A6/B2). Sandbox worked via fallback; production needs it.
- ✅ A6 numeric App Apple ID = `6793615366`; B2 `APPLE_APP_APPLE_ID` set on CapRover.

**REMAINING — all manual in App Store Connect / on device:**
- **A1** metadata scrub (World Cup from description/subtitle/keywords/promo/What's New) + upload the 5 screenshots.
- Add each sub's **review screenshot** (grab the Plan & billing / purchase screen) → set both to **Ready to Submit**.
- **A4** App Privacy = no tracking · **A5** Server Notifications URL · **B1** Clerk Terms/Privacy URLs.
- **D** record the 5 videos · paste reviewer **NOTES + E1/E2/E3** · **F3** upload the IAP build · **F4** Submit.

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
| **2.1** NFC | ✅ **In-app NFC reader removed** (camera QR covers it) — nothing to clarify | — |

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
- ✅ **A6. Numeric App Apple ID = `6793615366`** → set as env `APPLE_APP_APPLE_ID` (B2, DONE).

## B. Server / env / database

- ⬜ **B1. Clerk dashboard → set Terms + Privacy URLs** (`/terms`, `/privacy`) so
  the shopper Clerk sign-in modal shows the consent line. (VendorPhoneLogin already
  shows it in code.)
- ✅ **B2. Env on CapRover:** `APPLE_APP_APPLE_ID=6793615366` set (verified; all 45
  env vars intact). `APPLE_IAP_BUNDLE_ID` left default (`ai.whatslocal.app`).
  `MODERATION_EMAIL` optional (defaults to hello@whatslocal.ai) — set later if wanted.
- ✅ **B3. Apple root certs** — DONE, but **embedded in code** not read from disk:
  `lib/apple-root-cas.ts` (the DER files corrupted through the deploy pipeline; PEM
  strings compiled into the bundle can't). `certs/apple/` + Dockerfile `COPY certs`
  remain as the source-of-truth reference for regenerating that module.
- ✅ **B4. `supabase db push`** — DONE 2026-07-29. Both migrations applied to prod
  (`xbbnvkvlrucrzobhopgh`): `20260729120000_apple_iap_subscriptions`,
  `20260729130000_ugc_moderation`. Verified: `content_reports`/`user_blocks`/
  `banned_authors` tables now return 200.

## C. Xcode / native (whatslocal-ios)

- ✅ **C1.** `npm install` + `npx cap sync ios` — `whatslocal-iap` StoreKit plugin in the build.
- ✅ **C2.** Xcode → In-App Purchase capability added; app runs on device.
- ✅ **C3.** Sandbox purchase **succeeded end-to-end** — charged (sandbox), server
  verified, Pro unlocked. (Required the two IAP fixes above.)

## D. Videos to record (physical device, for the App Review notes)

- ⬜ **D1.** EULA/consent shown before login (open the login modal — the Terms line
  is under the Google/Apple buttons).
- ⬜ **D2.** Report a post (open a post → ⋯ → Report → pick a reason → it disappears).
- ⬜ **D3.** Block a user (open a post → ⋯ → Block → their content disappears).
- ⬜ **D4.** Account deletion (Profile/shopper OR vendor dashboard → Delete account →
  full flow to confirmation).
- ~~**D5.** NFC~~ — **REMOVED.** The in-app NFC reader was taken out (commit `5e014e8`);
  camera QR covers it, so no NFC video is needed. (Physical NFC fobs with a URL still
  work via iOS native tag reading — no app capability required.)

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
- ~~**E3.** NFC clarification~~ — not needed; NFC removed from the app.

## F. Deploy & resubmit

- ✅ **F1.** DONE 2026-07-29. Built web → deployed to CapRover (`marketplace`).
  Gate passed pre-ship: local `:3100/vendor` → 307. Demo mode off (`.env.production.local`).
- ✅ **F2.** DONE 2026-07-29. Prod verified: `/vendor` → 307, home → 200,
  `/world-cup` + `/watch-world-cup` → 404, `/api/admin/moderation` → 403 (route now
  live, was 404). *Still to eyeball on-device: a post's ⋯ → Report/Block actually
  writing (tables exist + route deployed, but not walked by a real signed-in user).*
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
- IAP is now **verified end-to-end in sandbox** (buy → verify → unlock). Production
  purchases should verify too now that `APPLE_APP_APPLE_ID` is set, but that path is
  only exercisable with a real App Store build post-approval.
- Whether Shorts was in the rejected build (the video bug) — see D-note.
- Acceptance itself — App Review is judgment-based. This closes every line of the
  feedback; it does not guarantee the outcome.
