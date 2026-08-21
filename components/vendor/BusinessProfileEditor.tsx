"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Check, ExternalLink, AlertCircle } from "lucide-react";
import {
  LinkEditor,
  brokenLinks,
  cleanLinkSet,
  type LinkSet,
} from "@/components/links/LinkEditor";

// The vendor's own business profile: everything a shopper sees, in one place,
// editable.
//
// ── Built for a phone first ───────────────────────────────────────────────
// This is the screen a shop owner opens standing behind their counter. So:
// ONE column at every width (a two-column form on a desktop would mean two
// layouts to keep true, and this page has no content that needs the room), full
// -width inputs at 16px — anything smaller and iOS zooms the whole page on
// focus, which is the single most common way a mobile form feels broken — and
// a save bar that STICKS to the bottom of the screen. A save button at the end
// of a long form on a phone is a save button nobody finds.
//
// ── Two endpoints, one button ─────────────────────────────────────────────
// The details are the connector member profile (/about) and the links are split
// across the profile and vendor_settings (/links). That is two writes, and the
// person pressing Save does not care: both go out together, and the button only
// says "Saved" if both came back ok.
//
// The link editor is components/links/LinkEditor — the same component the
// onboarding step uses, so the screen where you first add a link and the screen
// where you later fix it cannot drift apart.

export interface BusinessDetails {
  name?: string;
  bio?: string;
  category?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  hours?: string;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-stone-600">{label}</span>
      {hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-stone-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// 16px minimum, or iOS zooms the page when the field takes focus.
const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[16px] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-900";

export function BusinessProfileEditor({
  memberId,
  initialDetails,
  /** The public page, so they can check their work. */
  publicHref,
}: {
  memberId: string;
  initialDetails: BusinessDetails;
  publicHref: string;
}) {
  const [details, setDetails] = useState<BusinessDetails>(initialDetails);
  const [links, setLinks] = useState<LinkSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  // Links are loaded client-side rather than passed in: they live in three
  // places (member profile, support_links, other_links) and the route already
  // knows how to reassemble them. Duplicating that in a server component would
  // be a second copy of the same rule.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/members/${memberId}/links`);
        const d = await res.json();
        if (!cancelled) setLinks(res.ok ? { links: d.links ?? [], custom: d.custom ?? [] } : { links: [], custom: [] });
      } catch {
        if (!cancelled) setLinks({ links: [], custom: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const up = (k: keyof BusinessDetails, v: string) => {
    setDetails((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const broken = links ? brokenLinks(links) : [];

  async function save() {
    setErr("");
    if (broken.length > 0) return setErr(broken.join(" · "));
    setSaving(true);
    try {
      const clean = links ? cleanLinkSet(links) : null;
      const [aboutRes, linksRes] = await Promise.all([
        fetch(`/api/members/${memberId}/about`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bio: details.bio ?? "",
            category: details.category ?? "",
            city: details.city ?? "",
            neighborhood: details.neighborhood ?? "",
            address: details.address ?? "",
            hours: details.hours ?? "",
          }),
        }),
        clean
          ? fetch(`/api/members/${memberId}/links`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(clean),
            })
          : Promise.resolve(null),
      ]);
      // Whichever failed, say which — "couldn't save" on a form with two halves
      // leaves someone re-typing the half that already went through.
      if (!aboutRes.ok) {
        const d = await aboutRes.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't save your details.");
      }
      if (linksRes && !linksRes.ok) {
        const d = await linksRes.json().catch(() => ({}));
        throw new Error(d.error || "Your details saved, but the links didn't.");
      }
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    // Bottom padding clears the sticky save bar AND the app's own bottom nav.
    <div className="mx-auto max-w-2xl space-y-8 pb-40">
      <section className="space-y-4">
        <div>
          <h2 className="text-[17px] font-semibold text-stone-900">The basics</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">
            What people read first when they land on your page.
          </p>
        </div>

        {details.name && (
          // Read-only on purpose: the name came from the Google listing this
          // account was verified against, and changing it here would put the
          // page out of step with the thing that proves it is yours.
          <Field label="Business name" hint="From your Google listing — contact us to change it.">
            <input value={details.name} readOnly className={`${inputClass} bg-stone-50 text-stone-500`} />
          </Field>
        )}

        <Field label="About" hint="A few sentences. What you do, and what makes it worth the walk.">
          <textarea
            value={details.bio ?? ""}
            onChange={(e) => up("bio", e.target.value)}
            rows={5}
            placeholder="We're a family bakery on Valencia, open since 2011…"
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>

        <Field label="Category" hint="How you'd describe yourself in two words.">
          <input
            value={details.category ?? ""}
            onChange={(e) => up("category", e.target.value)}
            placeholder="Bakery"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City">
            <input
              value={details.city ?? ""}
              onChange={(e) => up("city", e.target.value)}
              placeholder="San Francisco"
              className={inputClass}
            />
          </Field>
          <Field label="Neighborhood">
            <input
              value={details.neighborhood ?? ""}
              onChange={(e) => up("neighborhood", e.target.value)}
              placeholder="Mission"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Address" hint="Where people find you. Leave blank if you have no public address.">
          <input
            value={details.address ?? ""}
            onChange={(e) => up("address", e.target.value)}
            placeholder="600 Guerrero St, San Francisco, CA"
            className={inputClass}
          />
        </Field>

        <Field label="Opening hours" hint="Free text — write it the way you'd say it.">
          <textarea
            value={details.hours ?? ""}
            onChange={(e) => up("hours", e.target.value)}
            rows={3}
            placeholder={"Tue–Sun 8am–4pm\nClosed Mondays"}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[17px] font-semibold text-stone-900">Your links</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">
            Everywhere else people can reach you, follow you, or buy from you. All of it shows on
            your page.
          </p>
        </div>

        {links === null ? (
          <div className="flex items-center gap-2 py-8 text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[14px]">Loading your links…</span>
          </div>
        ) : (
          <LinkEditor
            value={links}
            onChange={(v) => {
              setLinks(v);
              setSaved(false);
            }}
          />
        )}
      </section>

      {/* The save bar. Fixed to the bottom of the SCREEN, above the app's own
          bottom nav, because this form is long and on a phone the end of it is
          several scrolls away from wherever you just made a change. */}
      <div
        className="fixed inset-x-0 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur"
        style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href={publicHref}
            target="_blank"
            className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-stone-500 transition hover:text-stone-900"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View page</span>
          </Link>
          <div className="min-w-0 flex-1">
            {err ? (
              <p className="flex items-center gap-1.5 truncate text-[12px] text-rose-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {err}
              </p>
            ) : broken.length > 0 ? (
              <p className="truncate text-[12px] text-rose-600">{broken[0]}</p>
            ) : saved ? (
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Saved
              </p>
            ) : null}
          </div>
          <button
            onClick={() => void save()}
            disabled={saving || broken.length > 0}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
