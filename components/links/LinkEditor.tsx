"use client";

import { useState } from "react";
import { Plus, X, Link2 } from "lucide-react";
import { PlatformIcon } from "@/components/join/PlatformIcon";
import {
  CONTACT_AND_SOCIAL,
  SHOP_PLATFORMS,
  SUPPORT_PLATFORMS,
  platformById,
  type LinkKind,
  type LinkPlatform,
  type StoredLink,
  type CustomLink,
} from "@/lib/links";

// Every link a member has, edited in one place.
//
// Shared by the onboarding step (components/join/LinksStep) and the vendor's
// own profile page (/vendor/about) — one implementation, so the screen where
// you first add a link and the screen where you later fix it cannot drift into
// two different ideas of what a link is.
//
// ── The shape ─────────────────────────────────────────────────────────────
// Linktree's model, because it is the right one for this job:
//
//   • ADDED LINKS ARE ROWS, and every row keeps its input open, always. What
//     you have added is a list you can read top to bottom and correct in place.
//     Nothing collapses, nothing hides, and removing is an ✕ on the row.
//   • You add from a PICKER of brand pills underneath. A platform already added
//     drops out of the picker, because it is now a row above.
//
// This started as a grid where tapping a tile opened its input and tapping the
// next CLOSED it — so the box you had just typed into disappeared, and there
// was no way to see two handles at once to check them.
//
// ── Support links ─────────────────────────────────────────────────────────
// Their own section, their own sentence. They are external — Cash App, Venmo,
// Patreon — and route around Stripe Connect entirely: we take no fee and there
// is no order. They must never share a row with something purchasable (App
// Store 3.1.1). Folding them in with the socials would have been tidier and
// wrong.

export interface LinkSet {
  /** Every platform link, whatever its kind. The server sorts them on save. */
  links: StoredLink[];
  /** Free title + URL rows, in the member's order. */
  custom: CustomLink[];
}

/** An added link: brand block, its input (always open), and a way to remove it. */
function LinkRow({
  platform,
  value,
  onChange,
  onRemove,
}: {
  platform: LinkPlatform;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  // Checked as you type, but only COMPLAINED about once you have stopped
  // typing something that could still become valid: `h`, `he`, `hel` on the
  // way to an email address are not mistakes, and a box that goes red on the
  // first keystroke trains people to ignore it. `touched` flips on blur.
  const [touched, setTouched] = useState(false);
  const problem = platform.validate?.(value) ?? null;
  const show = touched && !!value.trim() && !!problem;

  return (
    <div>
      <div
        className={
          "flex items-center gap-3 rounded-2xl border bg-white p-2.5 " +
          (show ? "border-rose-300" : "border-stone-200")
        }
      >
        {/* The brand ground carries the colour, the row stays white — a column
            of fully brand-coloured rows fights itself and the save button. */}
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${platform.tile}`}
          aria-hidden
        >
          <PlatformIcon platform={platform} className="h-[22px] w-[22px]" />
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">{platform.label}</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={platform.placeholder}
            inputMode={
              platform.id === "phone"
                ? "tel"
                : platform.id === "email"
                  ? "email"
                  : platform.input === "url"
                    ? "url"
                    : "text"
            }
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={show || undefined}
            className="w-full bg-transparent text-[15px] text-stone-900 outline-none placeholder:text-stone-400"
          />
          <span className="block text-[11px] font-medium uppercase tracking-wide text-stone-400">
            {platform.label}
          </span>
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${platform.label}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {show && <p className="mt-1 pl-1 text-[12px] text-rose-600">{problem}</p>}
    </div>
  );
}

/** The shelf you add from. A platform already added isn't offered again. */
function Picker({
  platforms,
  added,
  onAdd,
}: {
  platforms: LinkPlatform[];
  added: string[];
  onAdd: (id: string) => void;
}) {
  const left = platforms.filter((p) => !added.includes(p.id));
  if (left.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {left.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onAdd(p.id)}
          className="group inline-flex items-center gap-2 rounded-full border-2 border-stone-200 bg-white py-1.5 pl-1.5 pr-4 text-left transition hover:border-stone-900 active:scale-[0.98]"
        >
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${p.tile}`}
            aria-hidden
          >
            <PlatformIcon platform={p} className="h-4 w-4" />
          </span>
          <span className="text-[14px] font-medium text-stone-700 group-hover:text-stone-900">
            {p.label}
          </span>
        </button>
      ))}
    </div>
  );
}

const MAX_CUSTOM = 12;

/** Everything typed that can't work, named by platform. */
export function brokenLinks(set: LinkSet): string[] {
  return set.links
    .filter((l) => l.value.trim())
    .map((l) => {
      const p = platformById(l.id);
      const problem = p?.validate?.(l.value);
      return problem ? `${p?.label}: ${problem.toLowerCase()}` : null;
    })
    .filter(Boolean) as string[];
}

/** Rows with nothing typed in them aren't links — drop them on the way out. */
export function cleanLinkSet(set: LinkSet): LinkSet {
  return {
    links: set.links.filter((l) => l.value.trim()),
    custom: set.custom.filter((c) => c.title.trim() && c.url.trim()),
  };
}

export function LinkEditor({ value, onChange }: { value: LinkSet; onChange: (v: LinkSet) => void }) {
  const ofKind = (kind: LinkKind | LinkKind[]) => {
    const kinds = Array.isArray(kind) ? kind : [kind];
    return value.links.filter((l) => {
      const k = platformById(l.id)?.kind;
      return k ? kinds.includes(k) : false;
    });
  };

  const setLinks = (links: StoredLink[]) => onChange({ ...value, links });
  const addLink = (id: string) => setLinks([...value.links, { id, value: "" }]);
  const changeLink = (id: string, v: string) =>
    setLinks(value.links.map((l) => (l.id === id ? { ...l, value: v } : l)));
  const removeLink = (id: string) => setLinks(value.links.filter((l) => l.id !== id));

  const rows = (list: StoredLink[]) =>
    list.map((l) => {
      const p = platformById(l.id);
      if (!p) return null;
      return (
        <LinkRow
          key={l.id}
          platform={p}
          value={l.value}
          onChange={(v) => changeLink(l.id, v)}
          onRemove={() => removeLink(l.id)}
        />
      );
    });

  const custom = value.custom;
  const setCustom = (c: CustomLink[]) => onChange({ ...value, custom: c });

  return (
    <div className="space-y-8">
      {/* Contact leads: a phone number and an email are what a neighbour
          actually wants from a local business. The handles are how you follow
          it; the number is how you ask whether they have any left. */}
      <section className="space-y-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-stone-400">
          Contact &amp; social
        </p>
        {rows(ofKind(["contact", "social"]))}
        <Picker
          platforms={CONTACT_AND_SOCIAL}
          added={value.links.map((l) => l.id)}
          onAdd={addLink}
        />
      </section>

      {/* Where they already sell. Most businesses were selling somewhere before
          they met us, and a page that won't mention their real storefront looks
          like it is trying to replace it. Plain outbound links — ordinary
          commerce we point at, not our checkout and not support. */}
      <section className="space-y-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-stone-400">
            Where you already sell
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            A store, an ordering page, your own app — people should be able to buy from you the
            way they already do.
          </p>
        </div>
        {rows(ofKind("shop"))}
        <Picker platforms={SHOP_PLATFORMS} added={value.links.map((l) => l.id)} onAdd={addLink} />
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-stone-400">Support</p>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            Ways people can tip or back you directly. These go straight to you — WhatsLocal takes
            nothing and isn&apos;t involved in the payment.
          </p>
        </div>
        {rows(ofKind("support"))}
        <Picker platforms={SUPPORT_PLATFORMS} added={value.links.map((l) => l.id)} onAdd={addLink} />
      </section>

      {/* Anything with a name and an address. */}
      <section className="space-y-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-stone-400">
          Anything else
        </p>
        {custom.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-2.5"
          >
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-900 text-white"
              aria-hidden
            >
              <Link2 className="h-[22px] w-[22px]" />
            </span>
            <div className="min-w-0 flex-1">
              <input
                value={c.title}
                onChange={(e) =>
                  setCustom(custom.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
                placeholder="Label — e.g. Our menu"
                className="w-full bg-transparent text-[15px] font-medium text-stone-900 outline-none placeholder:text-stone-400"
              />
              <input
                value={c.url}
                onChange={(e) =>
                  setCustom(custom.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                }
                placeholder="https://…"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-transparent text-[13px] text-stone-500 outline-none placeholder:text-stone-400"
              />
            </div>
            <button
              type="button"
              onClick={() => setCustom(custom.filter((_, j) => j !== i))}
              aria-label="Remove link"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {custom.length < MAX_CUSTOM && (
          <button
            type="button"
            onClick={() => setCustom([...custom, { title: "", url: "" }])}
            className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-stone-300 px-4 py-2.5 text-[14px] font-medium text-stone-600 transition hover:border-stone-900 hover:text-stone-900"
          >
            <Plus className="h-4 w-4" /> Add a link
          </button>
        )}
      </section>
    </div>
  );
}
