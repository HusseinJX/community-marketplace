# Native App (iOS App Store) + PWA

## Goal
Ship WhatsLocal to the **iOS App Store** with native **maps, push notifications, and location**, without rewriting the Next.js app. Also add a **PWA layer** (installable web app, Android, web push) as the shared foundation.

## The two targets (they're different)
- **PWA** = installable from the browser ("Add to Home Screen"), works on Android + iOS Safari, supports web push (iOS 16.4+ for installed PWAs). **Not** the App Store.
- **App Store app** = a native wrapper Apple accepts. **Apple rejects pure-PWA / thin "just a website" wrappers (guideline 4.2)** unless there's real native value — which our maps/notifications/location features provide. So: native wrapper, with genuine native capability.

## Constraint that drives the approach
This is **server-rendered Next.js 16** (server components, API routes, Clerk) → it **cannot** be statically exported into a native bundle. So the wrapper loads the **hosted site** + adds native plugins. No rewrite (vs. a React Native/Expo port, which would be a full rebuild).

## Recommended stack
1. **PWA layer** — `manifest.json` + service worker (offline shell, installability, web push). Foundation; do regardless.
2. **Capacitor (Ionic)** iOS wrapper — native Xcode project → App Store, loads the hosted URL, exposes native plugins. Keeps the entire Next.js codebase as-is.
3. **Capacitor plugins** — Geolocation (CoreLocation), Push Notifications (APNs), optionally Google Maps (native) and Camera (native QR scan).
4. Maps: keep **react-leaflet in the WebView** for v1 (works as-is); native map plugin later if desired.

## The two real gotchas for our stack
- **Clerk auth in a WebView.** **Same Clerk instance + same user accounts carry over seamlessly** — web signups are the identical user in the app, same `vendor_profiles` linkage, same keys; nothing forks. Only the *sign-in mechanics* change, and only for **social OAuth**: embedded webviews block Google OAuth (`disallowed_useragent`), so social login must open in the **system browser** (`ASWebAuthenticationSession` / Capacitor Browser plugin) then hand the session back. **Email/password + email-code (OTP) work fine inside the webview unchanged.** Session persists via webview cookies across launches (verify token refresh survives restart; Clerk token sessions as fallback). Plan the social-OAuth handoff first — it's the most common wrapper headache.
- **Hosted-URL dependency (offline-light is fine for Apple).** Server-rendered → the app needs network for most screens. **Apple does NOT require offline functionality** (Uber/DoorDash/Instagram all require network). The only requirements: (1) **4.2 minimum functionality** — cleared by the native maps/location/push/QR features, *not* by offline support; (2) **graceful offline handling** — the app must not crash or show a blank white WebView with no connection; a clean "You're offline" fallback (the PWA service-worker shell) satisfies this. So offline-light = approved, as long as it fails nicely.

## Features

### Location
- Capacitor **Geolocation** plugin → native permission + CoreLocation (background if needed).
- `navigator.geolocation` in the WebView also works; the plugin gives finer control + background.
- Powers the existing map / "near me" browse.

### Maps
- v1: react-leaflet inside the WebView (no change).
- v2 (optional): Capacitor Google Maps for a native map surface.

### Push notifications
- **Native (App Store):** Capacitor **Push Notifications** plugin → **APNs**. Requires Apple Developer account, APNs key/cert, device-token registration, and a **send backend**.
  - **Send via the Trigger.dev project** already set up (e.g. a `send-push` task) — natural fit for fan-out + retries. Store device tokens per Clerk user in Supabase.
  - Use cases: order status (paid→ready→dispatched→delivered), "Live Now" venue alerts, saved-broadcast reminders, new local drops.
- **Web (PWA):** web push on iOS 16.4+ installed PWAs + Android — more limited; good as the no-App-Store path.

## Apple submission checklist (the actual work)
- Apple Developer Program ($99/yr), App ID, provisioning profiles, signing.
- APNs key/cert for push.
- App icons + splash, App Store Connect listing, screenshots.
- **Privacy nutrition labels** — location + notifications + any account data require disclosures; location needs a clear purpose string (`NSLocationWhenInUseUsageDescription`).
- **4.2 minimum-functionality** — lead the review with the native features (location-based discovery, push, QR camera) so it doesn't read as a wrapped website.
- Clerk OAuth via system browser (see gotcha) — test sign-in on a real device before submitting.

## Effort (honest)
- **Wrapping + maps + basic geolocation:** days. The code is easy.
- **Push (APNs + send backend) + PWA layer:** medium.
- **The real sink is Apple's process + the Clerk-in-webview auth flow**, not engineering.
- Realistic to a **submittable** build: ~1–2 weeks, mostly Apple setup, push config, assets, and review iteration.

## Build order
1. **PWA layer** (manifest + SW + web push) — immediate value, Android install, foundation.
2. **Capacitor iOS shell** loading the hosted URL + fix **Clerk auth via system browser**.
3. **Geolocation + Push plugins**; store device tokens in Supabase; **`send-push` Trigger.dev task**.
4. Apple Developer setup → certs → privacy labels → assets → submit (lead with native features for 4.2).
5. Later: native maps, native QR camera, background location, Android (Google Play) via the same Capacitor project.

## Related
- Push sends reuse the **Trigger.dev** project (catalog sync lives there too).
- Order-status pushes pair with the existing `orders` lifecycle (`paid → ready → dispatched → delivered`).
- "Live Now" + saved broadcasts are strong push triggers (`broadcasts` / `broadcast_saves`).
