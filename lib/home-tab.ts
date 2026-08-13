"use client";

// Which home tab you were on, so a detail page's back link returns you there
// instead of dumping you on Events.
//
// Why sessionStorage and not `document.referrer`: App Router client navigations
// don't update `document.referrer` — it stays whatever the *document* loaded
// with — so after a `<Link>` click it still points at wherever you originally
// entered the site, if anywhere. sessionStorage is written on the way out, which
// is the only moment we reliably know the answer.
//
// Session-scoped on purpose: this is "where I just was", not a preference. A new
// tab starts fresh on Events rather than inheriting a stale tab from hours ago.

export type HomeTab = "events" | "feed" | "shop" | "products";

// Events leads because it is the reason to open the app on a given day — what's
// on, near you, right now. For you / What's on are a toggle INSIDE it, not two
// top-level tabs: it is the same set of events read two ways, so splitting them
// spent two of four tab slots on one idea and pushed Feed and Shop to the edge
// of a phone. Chats is not here either — it lives as a pill inside Feed, since
// a community chat is a kind of community post, not a separate destination.
//
// Feed is HIDDEN, not deleted (2026-08-13). It has nothing in it yet — the
// seeding plan is features/community-feed-seeding.md — and a tab that asks the
// visitor to go first teaches them the app is empty. The body still renders,
// so `/?tab=feed` reaches it for testing; restore it by putting the entry back
// in this list (and unhiding it in BackToHome's default).
//
// Shops = the local business directory. Products = the marketplace grid. Two
// tabs because they answer different questions ("who is near me" vs "what can
// I buy"), and one used to be a small icon button hidden on the other's header.
const TAB_LABELS: Record<HomeTab, string> = {
  events: "Events",
  feed: "Feed",
  shop: "Shops",
  products: "Products",
};

/** The tabs the selector actually draws, in order. */
export const HOME_TABS: { id: HomeTab; label: string }[] = (
  ["events", "shop", "products"] as const
).map((id) => ({ id, label: TAB_LABELS[id] }));

// Both spellings are in the wild — `?tab=events` from before the split, and
// `?tab=foryou` / `?tab=whatson` from while it was split. All three mean the
// events tab; which VIEW they land on is the toggle's business, not the URL's.
const LEGACY: Record<string, HomeTab> = { foryou: "events", whatson: "events" };

// Every id the app can RENDER, which is a superset of the ones it offers —
// `feed` is hidden from the selector but still reachable by URL.
export function isHomeTab(v: string | null | undefined): v is HomeTab {
  return !!v && Object.prototype.hasOwnProperty.call(TAB_LABELS, v);
}

/** A tab id from anywhere untrusted (URL, storage), old names included. */
export function toHomeTab(v: string | null | undefined): HomeTab | null {
  if (isHomeTab(v)) return v;
  return v ? LEGACY[v] ?? null : null;
}

const KEY = "wl_home_tab";

/** Called by HomeTabs whenever the visible tab changes. */
export function rememberHomeTab(tab: HomeTab): void {
  try {
    window.sessionStorage.setItem(KEY, tab);
  } catch {
    /* private mode — back links just fall back to Events */
  }
  // A tab is also an origin, so leaving home for a detail page comes back here.
  rememberOrigin(homeTabTarget(tab));
}

/** The tab to send someone back to. Defaults to Events (home's own default). */
export function lastHomeTab(): HomeTab {
  if (typeof window === "undefined") return "events";
  try {
    return toHomeTab(window.sessionStorage.getItem(KEY)) ?? "events";
  } catch {
    return "events";
  }
}

/** `{ href, label }` for a back link pointing at that tab. */
export function homeTabTarget(tab: HomeTab): { href: string; label: string } {
  return {
    // "/" IS the Events tab, so it is the one without a query param.
    href: tab === "events" ? "/" : `/?tab=${tab}`,
    label: TAB_LABELS[tab] ?? "Events",
  };
}

// ── The last place worth going back to ───────────────────────────────────────
// A home tab isn't the only origin. Opening an event from a business profile
// should come back to that profile, not to a tab you were on five screens ago.
// So any page that can *send* you somewhere records itself here, and a back link
// prefers this over the tab.

export interface BackOrigin {
  href: string;
  label: string;
}

const ORIGIN_KEY = "wl_back_origin";

export function rememberOrigin(origin: BackOrigin): void {
  try {
    window.sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
  } catch {
    /* private mode — back links fall back to the home tab */
  }
}

export function lastOrigin(): BackOrigin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as BackOrigin).href === "string" &&
      typeof (parsed as BackOrigin).label === "string"
    ) {
      return parsed as BackOrigin;
    }
    return null;
  } catch {
    return null;
  }
}
