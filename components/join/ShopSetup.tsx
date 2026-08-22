"use client";

import { useState } from "react";
import { AddProductsAI } from "@/components/join/AddProductsAI";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Landmark,
  ShoppingBag,
  CalendarCheck,
  Download,
  Truck,
  ExternalLink,
  Check,
  PartyPopper,
} from "lucide-react";

// Setting up the shop, straight after the links step: catalogue, then money.
// What those two unlocked is explained on the "ready" screen, which now runs
// AFTER the interview — see the startAt prop.
//
// THE ORDER IS THE POINT. Catalogue first, because a payout account with
// nothing to sell is a form you filled in for no reason, while a catalogue with
// no payouts is still a browsable shop. Someone who stops after screen one has
// something; someone who stops after a bank form has nothing.
//
// ── Why the hosted flows open in a NEW TAB ────────────────────────────────
// Square (via Composio) and Stripe both hand back a hosted URL, and both come
// back to /vendor/integrations — those return URLs are baked into the commerce
// plumbing and are right for the portal, which is where a vendor edits this
// later. Navigating there from HERE would end onboarding two screens early and
// silently drop the last screen, which is the one that explains what they can
// now do.
//
// So the tab opens beside us and this flow stays where it is. The tab is opened
// SYNCHRONOUSLY on click, before the fetch — a window.open() after an await is
// a popup blocked by every browser — and pointed at the URL once it arrives.
//
// Everything is skippable. Both of these are also permanently available in the
// portal, so nothing here is a last chance, and saying so is what stops the
// screens reading as a gate.

type Sub = "catalog" | "payments" | "ready";

function SetupScreen({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: typeof Boxes;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral-50">
          <Icon className="h-7 w-7 text-coral-600" />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-stone-900">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-500">{sub}</p>
      </header>
      {children}
    </div>
  );
}

/** The primary "carry on" button, identical on every setup screen. */
function Next({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3.5 text-[15px] font-semibold text-white transition hover:bg-stone-800"
    >
      {label} <ArrowRight className="h-4 w-4" />
    </button>
  );
}

/** The quiet way past. Always present — see the note about gates above. */
function Later({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-1 text-[13px] font-medium text-stone-400 transition hover:text-stone-700"
    >
      {label}
    </button>
  );
}

export function ShopSetup({
  memberId,
  memberName,
  /**
   * Which half this instance is. "catalog" runs the shop (products, then
   * payments) and finishes into the interview; "ready" is the three-ways-to-
   * sell explainer, shown after it. Split because the interview belongs
   * between them (2026-08-22): the explainer reads as a summary of what you
   * have set up, and a summary is the wrong thing to interrupt.
   */
  startAt = "catalog",
  /** Demo opens no hosted flow and connects nothing. */
  demo = false,
  onProducts,
  onFinish,
}: {
  memberId: string;
  memberName: string;
  startAt?: Sub;
  demo?: boolean;
  /** What they listed here, handed up so the interview can ask about it. */
  onProducts?: (names: string[]) => void;
  onFinish: () => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [sub, setSub] = useState<Sub>(startAt);
  const [busy, setBusy] = useState<"square" | "stripe" | null>(null);
  const [err, setErr] = useState("");
  // "Opened" rather than "connected": the connecting happens in the other tab,
  // and claiming it finished here would be a status we cannot see.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  async function openHosted(which: "square" | "stripe") {
    setErr("");
    if (demo) {
      setOpened({ ...opened, [which]: true });
      return;
    }
    // Synchronously, inside the click — see the note at the top.
    const tab = window.open("", "_blank");
    setBusy(which);
    try {
      const res =
        which === "square"
          ? await fetch("/api/vendor/composio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "connect", platform: "square" }),
            })
          : await fetch("/api/stripe-connect/create-account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
      const data = await res.json();
      // Selling is free, so a 402 is no longer a plan wall — keep the branch
      // (the route can still return one) but stop naming a price for it.
      if (res.status === 402) {
        tab?.close();
        setErr("Could not start payment setup just now — you can do it any time from your dashboard.");
        return;
      }
      const url: string | undefined = data.url || data.onboardingUrl;
      if (!url) {
        tab?.close();
        setErr(data.error || "Couldn't start that just now. You can do it later from your dashboard.");
        return;
      }
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener");
      setOpened({ ...opened, [which]: true });
    } catch {
      tab?.close();
      setErr("Couldn't start that just now. You can do it later from your dashboard.");
    } finally {
      setBusy(null);
    }
  }

  if (sub === "catalog") {
    return (
      <SetupScreen
        icon={Boxes}
        title="Bring in what you sell"
        sub="Two ways: pull a Square catalogue across, or photograph your menu and we'll read it. Either way your page isn't empty on day one."
      >
        {err && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{err}</p>}

        <button
          onClick={() => void openHosted("square")}
          disabled={busy === "square"}
          className="flex w-full items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 active:scale-[0.98] disabled:opacity-60 sm:p-5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-stone-900 text-white sm:h-14 sm:w-14">
            {busy === "square" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : opened.square ? (
              <Check className="h-6 w-6" />
            ) : (
              <ShoppingBag className="h-6 w-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-stone-900 sm:text-[17px]">
              Connect Square
            </span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-stone-500">
              {opened.square
                ? "Opened in another tab — finish there, then come back."
                : "Imports your catalog and keeps it in step. Opens in a new tab."}
            </span>
          </span>
          <ExternalLink className="h-5 w-5 shrink-0 text-stone-300" />
        </button>

        {/* The other way in, for the vendor with no register — which is most
            of them. Not a footnote under the Square button: "photograph your
            menu" is the shorter path to a page that isn't empty, and burying
            it made Square look like the only way to have a catalogue. */}
        <div className="pt-1">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-400">
            No register? Add them here
          </p>
          <AddProductsAI
            memberId={memberId}
            memberName={memberName}
            demo={demo}
            onSaved={(names) => {
              const all = [...added, ...names];
              setAdded(all);
              onProducts?.(all);
            }}
          />
        </div>

        {added.length > 0 && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
            {added.length} {added.length === 1 ? "product" : "products"} added — {added.slice(0, 3).join(", ")}
            {added.length > 3 ? "…" : ""}
          </p>
        )}

        <div className="space-y-2 pt-2">
          <Next label="Next — getting paid" onClick={() => { setErr(""); setSub("payments"); }} />
          <Later label="Skip, I'll add products later" onClick={() => { setErr(""); setSub("payments"); }} />
        </div>
      </SetupScreen>
    );
  }

  if (sub === "payments") {
    return (
      <SetupScreen
        icon={Landmark}
        title="Where should your money land?"
        sub="Stripe handles the card details and pays you out — we never see a bank number. This is what turns a listing into something someone can actually buy."
      >
        {err && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">{err}</p>}

        <button
          onClick={() => void openHosted("stripe")}
          disabled={busy === "stripe"}
          className="flex w-full items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 active:scale-[0.98] disabled:opacity-60 sm:p-5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-600 text-white sm:h-14 sm:w-14">
            {busy === "stripe" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : opened.stripe ? (
              <Check className="h-6 w-6" />
            ) : (
              <Landmark className="h-6 w-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-stone-900 sm:text-[17px]">
              Set up payouts with Stripe
            </span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-stone-500">
              {opened.stripe
                ? "Opened in another tab — finish there, then come back."
                : "Takes a few minutes. Opens in a new tab."}
            </span>
          </span>
          <ExternalLink className="h-5 w-5 shrink-0 text-stone-300" />
        </button>

        {/* Back to the catalogue — the one step in here worth returning to,
            and the likeliest reason to: you remembered another product. */}
        <button
          onClick={() => { setErr(""); setSub("catalog"); }}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-stone-400 transition hover:text-stone-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to your products
        </button>

        <div className="space-y-2 pt-2">
          <Next label="Next — tell us about you" onClick={() => { setErr(""); onFinish(); }} />
          <Later label="Skip, I'm not selling yet" onClick={() => { setErr(""); onFinish(); }} />
        </div>
      </SetupScreen>
    );
  }

  // What the last two screens just unlocked. Deliberately the LAST thing, not
  // the first: told up front it is a features list nobody has any use for yet;
  // told here it is a list of things you can now go and do.
  return (
    // Four, and only three of them are a handover — bookings is time, not a
    // parcel. Named for what you sell rather than how it travels, so the odd
    // one out isn't odd.
    <SetupScreen
      icon={PartyPopper}
      title="Four ways to sell here"
      sub="All from the same page. Turn any of them on whenever you like — nothing here is decided now."
    >
      <div className="space-y-3">
        {[
          {
            icon: CalendarCheck,
            title: "Bookings",
            body: "A cut, a class, a table, a session. They ask for a time and you confirm it — or offer a different one. No calendar to keep in step.",
          },
          {
            icon: ShoppingBag,
            title: "Pickup",
            body: "They pay online, you get the order, they collect it from you. No address on file? Checkout tells them you'll be in touch about where.",
          },
          {
            icon: Truck,
            title: "Self delivery",
            body: "You drive it over yourself and KEEP the delivery fee — we don't take a cut of it. Set your fee, a minimum order, and the ZIP codes you'll go to.",
          },
          {
            icon: Download,
            title: "Digital",
            body: "A recipe, a preset, a zine. They pay once and the download arrives straight after — nothing to pack, nothing to post.",
          },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral-50">
              <f.icon className="h-5 w-5 text-coral-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-stone-900">{f.title}</p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-stone-500">{f.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Last screen of onboarding: the shop is set up and the interview is
          done, so this is a summary of what they can now do with it. */}
      <div className="space-y-2 pt-2">
        <Next label="Finish" onClick={onFinish} />
        <a
          href={`/members/${memberId}`}
          className="block w-full py-1 text-center text-[13px] font-medium text-stone-400 transition hover:text-stone-700"
        >
          or see your public page
        </a>
      </div>
    </SetupScreen>
  );
}
