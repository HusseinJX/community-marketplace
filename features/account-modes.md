# One account, two modes — shopper ⇄ vendor

**Status:** spec. Nothing built.

Today a person who runs a business **cannot reach the shopper side of the app
at all**. This proposes replacing that fork with a switch, the way Airbnb lets
one account move between travelling and hosting.

---

## 1 · What is already true

There is **one Clerk user**. `vendor_profiles` is a join table:

```
vendor_profiles(clerk_user_id → member_id)
```

"Is this person a vendor" is nothing more than "does a row exist". There is no
second account, no second login, no separate credential. `resolveActor`
(`lib/admin.ts`) reads the same link to decide what a request may write.

So the account model needed for two modes **already exists**. Only the routing
disagrees with it.

## 2 · What the code does with that

`app/shopper/page.tsx`:

```ts
const vendor = await getVendorProfile(userId).catch(() => null);
if (vendor?.member_id) redirect("/vendor");
```

Server-side, before render. A linked user cannot open `/shopper` — not "is
sent somewhere better", **cannot open it**. Everything hanging off it goes with
it: saved places, cart, tickets, orders, personalization.

`ShopperClient` carries a comment asserting *"shopper and vendor are separate
accounts"*. **That comment is wrong**, and this redirect was built on it. The
schema has always said one account with an optional link.

The practical result: a baker who wants to buy a ticket to someone else's event
has no route to their own tickets. They are a vendor, permanently, because a
row exists.

## 3 · The model to move to

One account. One profile. A **mode** that decides which surfaces and which
navigation you see — and nothing else.

```
mode : 'shop' | 'vendor'      ← a VIEW preference
vendor_profiles row exists?   ← the PERMISSION
```

### The rule that must not be broken

> **Mode is a view preference. It is never a permission.**

`middleware.ts` and `resolveActor` keep authorising off the `vendor_profiles`
row exactly as they do now. If any write path ever consults `mode`, then
"switch to vendor mode" becomes client-side privilege escalation — a shopper
flipping a stored string into someone's dashboard. Mode may decide what is
*shown*. It may never decide what is *allowed*.

### Shape

- **Storage:** `localStorage` (`wl_mode`), same pattern as the city override in
  `lib/home-position`. It is a preference, not a fact about the account, so it
  does not need a column. A module store keyed on `globalThis` — see
  `lib/home-header` for why that specifically: `TopNav` comes from the root
  layout and pages come from the page tree, and a plain module-level store gets
  instantiated twice.
- **Default:** a linked user lands in `vendor` on first visit (that is what they
  came for). Thereafter, whatever they last chose.
- **Visibility:** the switcher renders only when a `vendor_profiles` row exists.
  A shopper never sees it — for them there is no second mode, and "Switch to
  hosting" as an upsell belongs in "Join as a vendor", which already exists.

### What changes per mode

|  | shop | vendor |
|---|---|---|
| `TopNav` | city · search · Events/Shops/Products | business name · vendor sections |
| `BottomNav` (mobile) | Explore · Saved · Cart · Tickets · Profile | Home · Orders · Events · Messages · Profile |
| `/` | the marketplace | redirect to `/vendor` |
| `/shopper` | the shopper space | still reachable — it is where the switcher lives |

The vendor navigation already exists inside `app/vendor/*`; this is about
lifting it to the app shell rather than building it.

## 4 · Work

1. `lib/account-mode.ts` — the store: `useMode()`, `setMode()`, globalThis
   anchor, localStorage persistence, default from the link.
2. `useIsVendor()` — does a `vendor_profiles` row exist. Server-resolved once
   and handed to the client, not fetched per component.
3. **Delete the `/shopper` redirect.** Gate `/vendor/*` on the LINK (as now),
   never on mode.
4. `TopNav` / `BottomNav` — branch on mode.
5. The switcher — in the profile menu and on `/shopper`. Two rows with a check,
   like the city picker in `components/home/CityHeader`.
6. Restore `/shopper`'s content (see §5).

## 5 · This partly undoes a change made 2026-08-13

`/shopper` was just stripped to a login card (signed out) and the
personalization panel (signed in), on the explicit premise that **vendors never
see it**. Saved / Cart / Messages moved to the header menu and the tab bar.

Under a mode switch that premise is gone: `/shopper` becomes the shopper mode's
home and needs Saved, Tickets and Orders back on it. Decide this before
building anything on the current version — see §7 of
[`airbnb-design.md`](./airbnb-design.md) for exactly what was removed.

## 6 · ⚠️ Risks

- **This touches the LIVE iOS app.** The bottom tab bar is what a native user
  navigates by, and swapping it on a mode flip is a live behaviour change that
  reaches every App Store user on next launch. There is no forced-update
  mechanism, so it must stay backward-compatible with the shipped native bridge
  (`lib/native-*.ts`). Re-read `docs/context/ios-shipping.md` first.
- **A vendor in shop mode must not lose vendor notifications.** Push and email
  routing (`lib/notify.ts`) keys on the member, not on what the person is
  currently looking at. Nothing there should learn about mode.
- **Demo mode** (`/demo`) already swaps context by pathname
  (`DemoExitWatcher`, and `TopNav`'s old `adminContext`). Mode and demo must not
  end up as two systems answering the same question differently.
- **The stale comment in `ShopperClient` must be corrected** in the same change,
  or the next person rebuilds the fork from it.

## 7 · Open questions

1. **Does mode survive across devices?** localStorage says no. A column on
   `vendor_profiles` would — probably not worth it for a preference.
2. **Deep links.** A vendor in shop mode opens a link to their own dashboard:
   follow it and flip the mode, or follow it and leave the mode alone? Airbnb
   flips. Flipping is probably right, but it means URLs can change mode, which
   makes mode not purely a user choice.
3. **What does `/` do in vendor mode?** Redirecting to `/vendor` is simplest and
   matches Airbnb. But it means a vendor cannot browse the marketplace without
   switching — which is the exact complaint this spec exists to fix. The
   alternative is that `/` stays the marketplace in both modes and only the
   navigation differs. **Recommend the alternative**; it keeps mode about
   navigation rather than about which pages exist.
4. **Multiple businesses.** `vendor_profiles` is one row per Clerk user today.
   If one person ever runs two businesses, mode becomes a three-way choice and
   this design needs revisiting.
