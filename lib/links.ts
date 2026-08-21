// Every place a member can be found, in one catalogue.
//
// THREE kinds, and the split is load-bearing rather than cosmetic:
//
//   social  — Instagram, TikTok, X … Stored on the connector member profile,
//             in the fields the profile page already renders. No new storage.
//   support — Cash App, Venmo, Patreon … EXTERNAL money links. They route
//             around Stripe Connect entirely: we take no fee, we see no order,
//             and nothing about them is a purchase we facilitate. They live in
//             their own column and must never be rendered where a purchasable
//             item is (App Store 3.1.1 — an outbound link supporting a local
//             business or cause is fine; one that buys OUR subscription is
//             not). Keep them visually and structurally apart from Buy/Book.
//   custom  — title + URL, free-form, in the member's own order.
//
// Adding a social platform here is enough for the join step; whether it SHOWS
// on the profile depends on `profileField` being one the profile page reads.

import type { MemberProfile } from "@/lib/types";
import type { BrandName } from "@/components/brand/BrandIcons";

/** The non-brand glyphs. Kept as a closed set so a typo is a type error. */
export type LucideGlyph =
  | "lucide-globe"
  | "lucide-ticket"
  | "lucide-store"
  | "lucide-utensils"
  | "lucide-phone"
  | "lucide-mail";

/**
 * WHICH SECTION a link belongs to, and — because the sections store
 * differently — how it is saved. See the header note.
 */
export type LinkKind = "social" | "shop" | "contact" | "support";

export interface LinkPlatform {
  id: string;
  kind: LinkKind;
  label: string;
  /** What to type. Handles get an @ hint; urls ask for the address. */
  input: "handle" | "url";
  /** Placeholder for the input. */
  placeholder: string;
  /** Tailwind classes for the tile's brand ground. */
  tile: string;
  /**
   * The real brand mark (components/brand/BrandIcons), or a `lucide-*` glyph
   * for the entries that are not a brand at all (a website, a phone number) and
   * the one brand with no usable mark anywhere (Toast). Drawn by
   * components/join/PlatformIcon, which owns the mapping.
   */
  icon: BrandName | LucideGlyph;
  /** One line under the name on the tile. */
  blurb: string;
  /** Where the value lands on the connector profile (social only). */
  profileField?: keyof MemberProfile;
  /** Build the public href from the stored value. */
  href: (v: string) => string;
  /**
   * Reject a value that cannot possibly work, and say why in one line.
   * Returns null when it is fine.
   *
   * DELIBERATELY FORGIVING. This catches the mistakes that produce a dead link
   * on a public page — an email in the phone box, "instagram.com/tartine"
   * pasted where a handle goes, a URL with no dot in it. It does NOT try to
   * prove the account exists, and it never rejects something merely unusual:
   * a false "that's not valid" on a handle that IS valid is worse than a link
   * that 404s, because the person cannot get past it.
   */
  validate?: (v: string) => string | null;
}

// ── Shared validators ──────────────────────────────────────────────────────

/** A handle: no spaces, no @ in the middle, not a pasted URL. */
function handleCheck(v: string, hint = "just the handle"): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || /\w+\.\w{2,}\//.test(t)) return `Paste ${hint}, not the full link`;
  if (/\s/.test(t)) return "No spaces in a handle";
  if (t.replace(/^[@$]/, "").includes("@")) return "That looks like an email address";
  if (!/^[@$]?[A-Za-z0-9._-]{1,60}$/.test(t)) return "Letters, numbers, dots, dashes and underscores only";
  return null;
}

/** A web address. Bare domains are fine — asUrl adds the scheme. */
function urlCheck(v: string, host?: RegExp, hint?: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.includes(" ")) return "A web address can't contain spaces";
  let u: URL;
  try {
    u = new URL(asUrl(t));
  } catch {
    return "That doesn't look like a web address";
  }
  if (!/^https?:$/.test(u.protocol)) return "Only http and https links can be used";
  // A dot and something after it. "localhost" and "my shop" both fail here,
  // and both would be dead links on a public page.
  if (!/\.[a-z]{2,}$/i.test(u.hostname)) return "That doesn't look like a web address";
  if (host && !host.test(u.hostname)) return hint ?? "That's not the right site for this one";
  return null;
}

const handle = (v: string) => v.trim().replace(/^@/, "");
/** A pasted address may arrive bare ("tartinebakery.com") — make it clickable. */
export const asUrl = (v: string) => {
  const t = v.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export const SOCIAL_PLATFORMS: LinkPlatform[] = [
  {
    id: "instagram",
    kind: "social",
    icon: "Instagram",
    label: "Instagram",
    input: "handle",
    placeholder: "@yourbusiness",
    // The one gradient in the set, because Instagram's mark is a gradient and a
    // flat purple tile reads as "some purple app" at tile size.
    tile: "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400",
    blurb: "Photos and stories",
    profileField: "instagramHandle",
    href: (v) => `https://instagram.com/${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
  {
    id: "tiktok",
    kind: "social",
    icon: "TikTok",
    label: "TikTok",
    input: "handle",
    placeholder: "@yourbusiness",
    tile: "bg-stone-900",
    blurb: "Short videos",
    profileField: "tiktokHandle",
    href: (v) => `https://tiktok.com/@${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
  {
    id: "website",
    kind: "social",
    icon: "lucide-globe",
    label: "Website",
    input: "url",
    placeholder: "yourbusiness.com",
    tile: "bg-teal-600",
    blurb: "Your own site",
    profileField: "websiteUrl",
    href: asUrl,
    validate: (v) => urlCheck(v),
  },
  {
    id: "facebook",
    kind: "social",
    icon: "Facebook",
    label: "Facebook",
    input: "url",
    placeholder: "facebook.com/yourpage",
    tile: "bg-blue-600",
    blurb: "Your page",
    profileField: "facebookUrl",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)(facebook|fb)\.(com|me)$/i, "That's not a Facebook link"),
  },
  {
    id: "x",
    kind: "social",
    icon: "X",
    label: "X",
    input: "handle",
    placeholder: "@yourbusiness",
    tile: "bg-stone-800",
    blurb: "Quick updates",
    profileField: "xHandle",
    href: (v) => `https://x.com/${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
  {
    id: "youtube",
    kind: "social",
    icon: "YouTube",
    label: "YouTube",
    input: "url",
    placeholder: "youtube.com/@you",
    tile: "bg-red-600",
    blurb: "Video",
    profileField: "youtubeUrl",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)(youtube\.com|youtu\.be)$/i, "That's not a YouTube link"),
  },
  {
    id: "spotify",
    kind: "social",
    icon: "Spotify",
    label: "Spotify",
    input: "url",
    placeholder: "open.spotify.com/…",
    tile: "bg-emerald-600",
    blurb: "Your music",
    profileField: "spotifyUrl",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)spotify\.com$/i, "That's not a Spotify link"),
  },
  {
    id: "linkedin",
    kind: "social",
    icon: "LinkedIn",
    label: "LinkedIn",
    input: "url",
    placeholder: "linkedin.com/company/…",
    tile: "bg-sky-700",
    blurb: "Professional",
    profileField: "linkedinUrl",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)linkedin\.com$/i, "That's not a LinkedIn link"),
  },
];

// ── Where you already sell ─────────────────────────────────────────────────
// Most local businesses are already selling somewhere before they meet us — a
// Shopify store, an Etsy shop, a Toast ordering page, a delivery listing, even
// their own app. Pretending otherwise makes the page look like it wants to
// replace all of that, and makes their real storefront the one thing their
// WhatsLocal page doesn't mention.
//
// These are plain outbound links, exactly like the socials. They are NOT our
// checkout and they are not support links either: money may change hands at
// the other end, but it is the business's own storefront, which is ordinary
// commerce we simply link to. Support links are separate for a different
// reason — see the header.
//
// Square and Linktree are deliberately NOT offered (2026-08-13). Square is the
// register we ask them to CONNECT two screens later, in the shop setup, and
// offering it here as a link to somewhere else muddles the one thing that step
// is for. Linktree is a page of the same links this screen is collecting — a
// link to our own replacement. Both still resolve if one is already stored.
export const SHOP_PLATFORMS: LinkPlatform[] = [
  {
    id: "shopify",
    kind: "shop",
    icon: "Shopify",
    label: "Shopify",
    input: "url",
    placeholder: "yourshop.myshopify.com",
    tile: "bg-lime-600",
    blurb: "Your store",
    profileField: "shopifyUrl",
    href: asUrl,
    validate: (v) => urlCheck(v),
  },
  {
    id: "etsy",
    kind: "shop",
    icon: "Etsy",
    label: "Etsy",
    input: "url",
    placeholder: "etsy.com/shop/…",
    tile: "bg-orange-600",
    blurb: "Handmade shop",
    profileField: "etsyUrl",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)etsy\.com$/i, "That's not an Etsy link"),
  },
  {
    id: "toast",
    kind: "shop",
    // Toast has no mark in Simple Icons, and inventing one would be worse than
    // a clear generic: this is an ordering page, so it gets cutlery.
    icon: "lucide-utensils",
    label: "Toast",
    input: "url",
    placeholder: "order.toasttab.com/…",
    tile: "bg-orange-500",
    blurb: "Order & menu",
    href: asUrl,
    validate: (v) => urlCheck(v),
  },
  {
    id: "doordash",
    kind: "shop",
    icon: "DoorDash",
    label: "DoorDash",
    input: "url",
    placeholder: "doordash.com/store/…",
    tile: "bg-red-500",
    blurb: "Delivery listing",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)doordash\.com$/i, "That's not a DoorDash link"),
  },
  {
    id: "ubereats",
    kind: "shop",
    icon: "UberEats",
    label: "Uber Eats",
    input: "url",
    placeholder: "ubereats.com/store/…",
    tile: "bg-green-700",
    blurb: "Delivery listing",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)ubereats\.com$/i, "That's not an Uber Eats link"),
  },
  {
    id: "appstore",
    kind: "shop",
    icon: "AppStore",
    label: "iPhone app",
    input: "url",
    placeholder: "apps.apple.com/…",
    tile: "bg-sky-600",
    blurb: "On the App Store",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)apple\.com$/i, "That's not an App Store link"),
  },
  {
    id: "googleplay",
    kind: "shop",
    icon: "GooglePlay",
    label: "Android app",
    input: "url",
    placeholder: "play.google.com/…",
    tile: "bg-emerald-600",
    blurb: "On Google Play",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)google\.com$/i, "That's not a Google Play link"),
  },
  {
    id: "shop",
    kind: "shop",
    icon: "lucide-store",
    label: "Somewhere else",
    input: "url",
    placeholder: "where people already buy from you",
    tile: "bg-stone-600",
    blurb: "Any other store",
    profileField: "shopUrl",
    href: asUrl,
    validate: (v) => urlCheck(v),
  },
];

// ── How to reach a person ──────────────────────────────────────────────────
// Not links to elsewhere — the two ways people actually get hold of a small
// business. `tel:` and `mailto:` so a phone dials and a laptop opens the mail
// app, rather than rendering a number nobody can tap.
export const CONTACT_PLATFORMS: LinkPlatform[] = [
  {
    id: "phone",
    kind: "contact",
    icon: "lucide-phone",
    label: "Phone",
    input: "handle",
    placeholder: "(415) 555-0132",
    tile: "bg-stone-700",
    blurb: "Calls & texts",
    profileField: "businessPhone",
    href: (v) => `tel:${v.replace(/[^\d+]/g, "")}`,
    validate: (v) => {
      const digits = v.replace(/\D/g, "");
      if (!digits) return null;
      if (/[a-z]/i.test(v.replace(/^\s*ext\.?/i, ""))) return "Digits only, please";
      // Loose on purpose: 7 covers a local number, 15 is the E.164 ceiling, and
      // everything in between is a real number somewhere in the world.
      if (digits.length < 7 || digits.length > 15) return "That doesn't look like a phone number";
      return null;
    },
  },
  {
    id: "email",
    kind: "contact",
    icon: "lucide-mail",
    label: "Email",
    input: "handle",
    placeholder: "hello@yourbusiness.com",
    tile: "bg-indigo-600",
    blurb: "For enquiries",
    href: (v) => `mailto:${v.trim()}`,
    validate: (v) => {
      const t = v.trim();
      if (!t) return null;
      if (/\s/.test(t)) return "An email address can't contain spaces";
      // one @, something before it, a dot-something after it. Anything
      // stricter starts rejecting addresses that genuinely deliver.
      if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(t)) return "That doesn't look like an email address";
      return null;
    },
  },
];

// Support links. Deliberately a SHORT list of what a small local business is
// actually asked for — a long grid of payment apps starts to look like a
// checkout, which is exactly what these are not.
export const SUPPORT_PLATFORMS: LinkPlatform[] = [
  {
    id: "cashapp",
    kind: "support",
    icon: "CashApp",
    label: "Cash App",
    input: "handle",
    placeholder: "$yourcashtag",
    tile: "bg-green-600",
    blurb: "Your $cashtag",
    href: (v) => `https://cash.app/${v.trim().startsWith("$") ? v.trim() : `$${handle(v)}`}`,
    validate: (v) => handleCheck(v, "just your $cashtag"),
  },
  {
    id: "venmo",
    kind: "support",
    icon: "Venmo",
    label: "Venmo",
    input: "handle",
    placeholder: "@yourhandle",
    tile: "bg-sky-500",
    blurb: "Tip or split",
    href: (v) => `https://venmo.com/u/${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
  {
    id: "paypal",
    kind: "support",
    icon: "PayPal",
    label: "PayPal",
    input: "handle",
    placeholder: "yourname",
    tile: "bg-indigo-700",
    blurb: "PayPal.Me",
    href: (v) => `https://paypal.me/${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
  {
    id: "patreon",
    kind: "support",
    icon: "Patreon",
    label: "Patreon",
    input: "handle",
    placeholder: "yourpage",
    tile: "bg-orange-600",
    blurb: "Monthly support",
    href: (v) => `https://patreon.com/${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
  {
    id: "gofundme",
    kind: "support",
    icon: "GoFundMe",
    label: "GoFundMe",
    input: "url",
    placeholder: "gofundme.com/f/…",
    tile: "bg-emerald-700",
    blurb: "A campaign",
    href: asUrl,
    validate: (v) => urlCheck(v, /(^|\.)gofundme\.com$/i, "That's not a GoFundMe link"),
  },
  {
    id: "buymeacoffee",
    kind: "support",
    icon: "BuyMeACoffee",
    label: "Buy Me a Coffee",
    input: "handle",
    placeholder: "yourname",
    tile: "bg-amber-500",
    blurb: "One-off tips",
    href: (v) => `https://buymeacoffee.com/${handle(v)}`,
    validate: (v) => handleCheck(v),
  },
];

/**
 * The first section of the links step: how to reach a person, then where to
 * find them. Contact leads because a phone number and an email are what a
 * neighbour actually wants from a local business — the handles are how you
 * follow it, the number is how you ask whether they have any left.
 *
 * One list, two kinds. Where each one is STORED still follows the catalogue
 * (phone has a profile field, email does not), so merging them in the UI
 * changes nothing about the data.
 */

// ── Legacy display-only platforms ──────────────────────────────────────────
// Fields the connector already writes that the picker no longer offers.
//
// They are NOT in any picker — nobody adds a Threads handle through the links
// step — but plenty of members already have one, set by the interview, an
// admin, or the old thirteen-entry list the profile used to hard-code. Dropping
// them from the catalogue would have quietly deleted those links from the
// public page the moment it started reading the catalogue instead.
//
// So: present for DISPLAY and for `platformById`, absent from every picker.
// The pickers name their arrays explicitly (SOCIAL/SHOP/CONTACT/SUPPORT), so
// nothing here can leak into one by accident.
export const LEGACY_PLATFORMS: LinkPlatform[] = [
  {
    id: "twitter",
    kind: "social",
    icon: "X",
    label: "X",
    input: "handle",
    placeholder: "@yourbusiness",
    tile: "bg-stone-800",
    blurb: "Quick updates",
    // The pre-rename field. Same destination as `x`, which is why the profile
    // row shows whichever of the two is set.
    profileField: "twitterHandle",
    href: (v) => `https://x.com/${handle(v)}`,
  },
  {
    id: "threads",
    kind: "social",
    icon: "Threads",
    label: "Threads",
    input: "handle",
    placeholder: "@yourbusiness",
    tile: "bg-stone-900",
    blurb: "Posts",
    profileField: "threadsHandle",
    href: (v) => `https://threads.net/@${handle(v)}`,
  },
  {
    id: "soundcloud",
    kind: "social",
    icon: "SoundCloud",
    label: "SoundCloud",
    input: "url",
    placeholder: "soundcloud.com/you",
    tile: "bg-orange-500",
    blurb: "Your tracks",
    profileField: "soundcloudUrl",
    href: asUrl,
  },
  {
    id: "bandsintown",
    kind: "social",
    icon: "Bandsintown",
    label: "Bandsintown",
    input: "url",
    placeholder: "bandsintown.com/…",
    tile: "bg-sky-600",
    blurb: "Tour dates",
    profileField: "bandsintownUrl",
    href: asUrl,
  },
  {
    id: "meetup",
    kind: "social",
    icon: "Meetup",
    label: "Meetup",
    input: "url",
    placeholder: "meetup.com/…",
    tile: "bg-red-600",
    blurb: "Your group",
    profileField: "meetupUrl",
    href: asUrl,
  },
  {
    id: "pinterest",
    kind: "social",
    icon: "Pinterest",
    label: "Pinterest",
    input: "url",
    placeholder: "pinterest.com/you",
    tile: "bg-red-700",
    blurb: "Boards",
    profileField: "pinterestUrl",
    href: asUrl,
  },
  {
    id: "eventbrite",
    kind: "social",
    // No mark in Simple Icons; a ticket reads correctly and is honest about
    // being generic.
    icon: "lucide-ticket",
    label: "Eventbrite",
    input: "url",
    placeholder: "eventbrite.com/…",
    tile: "bg-orange-600",
    blurb: "Your tickets",
    profileField: "eventbriteUrl",
    href: asUrl,
  },
];

export const CONTACT_AND_SOCIAL = [...CONTACT_PLATFORMS, ...SOCIAL_PLATFORMS];

/** Everything the app can RENDER — a superset of what any picker offers. */
export const ALL_PLATFORMS = [
  ...SOCIAL_PLATFORMS,
  ...SHOP_PLATFORMS,
  ...CONTACT_PLATFORMS,
  ...SUPPORT_PLATFORMS,
  ...LEGACY_PLATFORMS,
];

export function platformById(id: string): LinkPlatform | undefined {
  return ALL_PLATFORMS.find((p) => p.id === id);
}

/** What gets stored: the raw value the member typed, keyed by platform. */
export interface StoredLink {
  id: string;
  value: string;
}

export interface CustomLink {
  title: string;
  url: string;
}

/**
 * Turn the links that HAVE a profile field into a profile patch. Everything
 * else is stored in vendor_settings by the route — see its header.
 *
 * Handles are stored WITHOUT the @ — the profile page rebuilds every href and
 * strips a leading @ defensively, so storing it would mean "@@handle" the day
 * that defence is removed. URLs are normalised to absolute here, because a
 * bare "tartine.com" in an href resolves against our own domain.
 */
export function profileFields(links: StoredLink[]): Partial<MemberProfile> {
  const fields: Partial<MemberProfile> = {};
  for (const { id, value } of links) {
    const p = platformById(id);
    if (!p?.profileField) continue;
    const v = value.trim();
    if (!v) continue;
    // Every profileField in the catalogue is a string field. Handles are
    // stored bare; a phone number keeps whatever formatting was typed, since
    // that is what gets shown; URLs become absolute.
    (fields as Record<string, string>)[p.profileField] =
      p.input === "url" ? asUrl(v) : p.id === "phone" ? v : handle(v);
  }
  return fields;
}
