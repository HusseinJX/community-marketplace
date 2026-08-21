"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Link2, Check } from "lucide-react";
import {
  LinkEditor,
  brokenLinks,
  cleanLinkSet,
  type LinkSet,
} from "@/components/links/LinkEditor";
import type { StoredLink } from "@/lib/links";

// "Where else can people find you?" — the one screen in onboarding that adds
// something the flow never asked for before.
//
// The editor itself is components/links/LinkEditor, shared with the vendor's
// own profile page. All this adds is the onboarding frame: the question, the
// save, and a way past. Everything here is optional — the primary button
// offers to skip until something is added, and is never a wall.
export function LinksStep({
  memberId,
  /**
   * Links we already know, from the Google listing we just verified against —
   * the website and the phone number. They arrive as ordinary rows the person
   * can edit or delete: prefilled, never imposed.
   */
  initialLinks = [],
  onDone,
  /** Demo runs the whole screen but never writes. */
  demo = false,
}: {
  memberId: string;
  initialLinks?: StoredLink[];
  onDone: () => void;
  demo?: boolean;
}) {
  const [set, setSet] = useState<LinkSet>(() => ({ links: initialLinks, custom: [] }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const clean = cleanLinkSet(set);
  const total = clean.links.length + clean.custom.length;
  // Anything typed that can't work. Saving one would put a dead link on a
  // public page, so the button says what's wrong instead of pressing on — and
  // it names the platform, since the offending row may be scrolled out of
  // sight by the time you reach the button.
  const broken = brokenLinks(set);

  async function save() {
    setErr("");
    if (broken.length > 0) return setErr(broken.join(" · "));
    if (total === 0 || demo) return onDone();
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${memberId}/links`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't save your links.");
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save your links.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral-50">
          <Link2 className="h-7 w-7 text-coral-600" />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-stone-900">
          Where else can people find you?
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-500">
          Add as many as you like — they all show on your page. You can change these any time.
        </p>
      </header>

      {err && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{err}</p>}

      <LinkEditor value={set} onChange={setSet} />

      <div className="space-y-2 pt-2">
        <button
          onClick={() => void save()}
          disabled={busy || broken.length > 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : total > 0 ? <Check className="h-4 w-4" /> : null}
          {total > 0 ? `Save ${total} link${total === 1 ? "" : "s"} & continue` : "Skip for now"}
          {!busy && total === 0 && <ArrowRight className="h-4 w-4" />}
        </button>
        {total > 0 && (
          <button
            onClick={onDone}
            disabled={busy}
            className="w-full py-1 text-[13px] font-medium text-stone-400 transition hover:text-stone-700 disabled:opacity-60"
          >
            Skip without saving
          </button>
        )}
      </div>
    </div>
  );
}
