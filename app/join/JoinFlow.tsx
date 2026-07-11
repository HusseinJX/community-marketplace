"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { VendorPhoneLogin } from "@/components/auth/VendorPhoneLogin";
import { Store, Users, Mic, Search, Loader2, Check, ArrowRight, LogOut, LogIn } from "lucide-react";
import { JoinInterview } from "@/components/join/JoinInterview";
import type { BriefInput } from "@/lib/onboard";

// Self-serve "fresh join" — matches the rep-flow mockup:
//   pick type → who you are + phone (code #1, Clerk) → confirm →
//   (entities) find business on Google → verify ownership (code #2, Twilio) →
//   (artists) straight through → done + plan picker.
// Reuses: Clerk phone auth, /api/places/*, /api/members/create, /api/otp,
// /api/claim, /api/vendor/profile.

type Kind = "vendor" | "organizer" | "artist";
type Step = "type" | "who" | "code1" | "business" | "code2" | "working" | "interview" | "done";

const TYPES: { key: Kind; icon: typeof Store; label: string; sub: string }[] = [
  { key: "vendor", icon: Store, label: "A business or vendor", sub: "Shop, bar, restaurant, maker" },
  { key: "organizer", icon: Users, label: "A community organization", sub: "Nonprofit, collective, org" },
  { key: "artist", icon: Mic, label: "An artist or performer", sub: "DJ, musician, creator" },
];

interface Place { placeId: string; name: string; address: string }

export function JoinFlow() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [loginOpen, setLoginOpen] = useState(false);

  // Onboarding creates a *vendor* account and must start from a logged-out
  // state — shopper and vendor are separate accounts you sign into separately.
  // So if anyone lands here already signed in, they log out first (below).
  const [signingOut, setSigningOut] = useState(false);
  async function logOutThenJoin() {
    setSigningOut(true);
    try {
      await clerk.signOut({ redirectUrl: "/join" });
    } catch {
      setSigningOut(false);
    }
  }

  const [step, setStep] = useState<Step>("type");
  const [kind, setKind] = useState<Kind>("vendor");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Owner");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneMode, setPhoneMode] = useState<"signup" | "signin">("signup");

  // business (entities)
  const [pq, setPq] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [bizName, setBizName] = useState("");
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  // artist-only extras (no Maps anchor → give the web-search a locale + handle)
  const [city, setCity] = useState("");
  const [igHandle, setIgHandle] = useState("");

  // "What we already know" baseline handed to the onboarding interview so it
  // opens warm — set from the Google Places pick (entities) or the artist form.
  const [seed, setSeed] = useState<BriefInput>({});

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isArtist = kind === "artist";

  // ── Step 1: type ──────────────────────────────────────────────────────────
  function pickType(k: Kind) {
    setKind(k);
    setStep("who");
    setErr("");
  }

  // ── Step 2: who you are → send phone code (Clerk) ──────────────────────────
  async function sendPhoneCode() {
    if (!name.trim()) return setErr("Add your name.");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Add a valid mobile number.");
    setBusy(true);
    setErr("");
    const e164 = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    try {
      // If already signed in, skip the phone step entirely.
      if (isSignedIn) {
        setStep(isArtist ? "working" : "business");
        if (isArtist) void finishArtist();
        return;
      }
      try {
        await clerk.client.signUp.create({ phoneNumber: e164 });
        await clerk.client.signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
        setPhoneMode("signup");
      } catch {
        // Phone already has an account → sign in with a code instead.
        const si = await clerk.client.signIn.create({ identifier: e164 });
        const factor = si.supportedFirstFactors?.find((f) => f.strategy === "phone_code") as
          | { strategy: "phone_code"; phoneNumberId: string }
          | undefined;
        if (!factor) throw new Error("Phone sign-in unavailable");
        await clerk.client.signIn.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
        setPhoneMode("signin");
      }
      setStep("code1");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't text a code. Check the number.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 3: confirm phone code #1 → sign in ────────────────────────────────
  async function confirmPhoneCode() {
    if (code.trim().length < 4) return setErr("Enter the 6-digit code.");
    setBusy(true);
    setErr("");
    try {
      if (phoneMode === "signup") {
        const res = await clerk.client.signUp.attemptPhoneNumberVerification({ code: code.trim() });
        if (res.status !== "complete") throw new Error("That code didn't match.");
        await clerk.setActive({ session: res.createdSessionId });
      } else {
        const res = await clerk.client.signIn.attemptFirstFactor({ strategy: "phone_code", code: code.trim() });
        if (res.status !== "complete") throw new Error("That code didn't match.");
        await clerk.setActive({ session: res.createdSessionId });
      }
      setCode("");
      if (isArtist) {
        setStep("working");
        void finishArtist();
      } else {
        setStep("business");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That code didn't match.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 4 (entities): find business on Google ─────────────────────────────
  async function searchBiz(q: string) {
    setPq(q);
    if (q.trim().length < 3) return setResults([]);
    setSearching(true);
    try {
      const r = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
      setResults((await r.json()).results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  // Pick a listing → create the (unclaimed) member from it → send ownership OTP.
  async function useListing(p: Place) {
    setResults([]);
    setPq(p.name);
    setBusy(true);
    setErr("");
    try {
      const details = (await (await fetch(`/api/places/details?placeId=${encodeURIComponent(p.placeId)}`)).json()).details;
      const profile = {
        name: p.name,
        memberType: kind,
        category: (details?.types || []).find((t: string) => !["point_of_interest", "establishment", "food", "store"].includes(t))?.replace(/_/g, " ") || undefined,
        city: details?.city || undefined,
        neighborhood: details?.neighborhood || undefined,
        // Capture the coordinates straight from Google Places — this is the only
        // reliable source. The connector only back-fills lat/lng by parsing
        // `@lat,lng` out of a Maps URL, and our place_id URL has no numbers, so
        // without these the business never lands on the /live map.
        latitude: typeof details?.lat === "number" ? details.lat : undefined,
        longitude: typeof details?.lng === "number" ? details.lng : undefined,
        phone: details?.phone || undefined,
        // businessPhone is what resolveOwnershipPhone reads for the ownership OTP
        // (it does NOT read `phone`); googleMapsUrl is the authoritative fallback.
        businessPhone: details?.phone || undefined,
        googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.placeId}`,
        businessDescription: details?.summary || undefined,
        websiteUrl: details?.website || undefined,
        ownerName: name,
        ownerRole: role,
      };
      const created = await (await fetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, mode: "self" }),
      })).json();
      if (!created.memberId) throw new Error(created.error || "Couldn't create the profile.");
      setMemberId(created.memberId);
      setBizName(p.name);
      // Baseline the interviewer already knows (Perplexity deepens it on top).
      setSeed({
        name: p.name,
        category: profile.category ?? null,
        city: details?.city ?? null,
        neighborhood: details?.neighborhood ?? null,
        description: details?.summary ?? null,
        websiteUrl: details?.website ?? null,
      });
      // Send the ownership code to the listing's phone.
      const otp = await (await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: created.memberId }),
      })).json();
      if (!otp.sent) {
        setErr(otp.error || "This listing has no phone we can verify. Try a different listing or ask an admin.");
        return; // stay on business step
      }
      setPhoneHint(otp.phoneHint || null);
      setStep("code2");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 5 (entities): verify ownership code #2 → claim + link ─────────────
  async function confirmOwnership() {
    if (code.trim().length < 4) return setErr("Enter the 6-digit code.");
    setBusy(true);
    setErr("");
    try {
      const res = await (await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, method: "phone_otp", value: code.trim() }),
      })).json();
      if (!res.verified && !res.ok) throw new Error(res.error || "That code didn't match the business's number.");
      await fetch("/api/vendor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      setStep("interview");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That code didn't match.");
    } finally {
      setBusy(false);
    }
  }

  // ── Artist finish: create self-owned member + link ─────────────────────────
  async function finishArtist() {
    setBusy(true);
    setErr("");
    try {
      const igClean = igHandle.trim().replace(/^@/, "");
      const created = await (await fetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name,
            memberType: "artist",
            ownerName: name,
            city: city.trim() || undefined,
            instagramHandle: igClean || undefined,
          },
          mode: "self",
        }),
      })).json();
      if (!created.memberId) throw new Error(created.error || "Couldn't create your page.");
      setMemberId(created.memberId);
      setBizName(name);
      // Artists have no Maps anchor — the seed (name + city + IG) is what the
      // web-search research keys off to open the interview knowing them.
      setSeed({ name, city: city.trim() || null, instagramHandle: igClean || null });
      await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: created.memberId, method: "self_owned", value: "me" }),
      });
      await fetch("/api/vendor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: created.memberId }),
      });
      setStep("interview");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setStep("who");
    } finally {
      setBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  // Wait for Clerk to resolve the session before deciding what to show.
  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  // Already signed in (as a shopper or a vendor)? Onboarding needs a clean,
  // logged-out start — log out first, then this same page shows the flow.
  if (isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <LogOut className="h-6 w-6 text-stone-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-stone-900">Log out first</h1>
        <p className="mt-2 text-sm text-stone-500">
          You&apos;re already signed in. Setting up a business, org, or artist page uses its own
          account, so log out here and we&apos;ll start you fresh.
        </p>
        <button
          onClick={logOutThenJoin}
          disabled={signingOut}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Log out &amp; continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      {step !== "type" && step !== "done" && step !== "interview" && (
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-stone-400">
          {isArtist ? "Artist" : step === "business" || step === "code2" ? "Step 2 of 2 · the business" : "Step 1 of 2 · you"}
        </p>
      )}
      {err && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{err}</p>}

      {step === "type" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-stone-900">Join WhatsLocal</h1>
          <p className="text-sm text-stone-500">What are you setting up? This decides how we verify you.</p>
          <div className="mt-3 space-y-2">
            {TYPES.map((t) => (
              <button key={t.key} onClick={() => pickType(t.key)} className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left hover:border-violet-300 hover:bg-violet-50">
                <t.icon className="h-5 w-5 text-violet-600" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-stone-900">{t.label}</span>
                  <span className="block text-xs text-stone-500">{t.sub}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </button>
            ))}
          </div>
          <p className="pt-1 text-xs text-stone-400">Business &amp; org prove an anchor. Artists are people — self-owned.</p>

          {/* Already have a vendor account (e.g. onboarded on another device)?
              Open the login modal — on success it goes straight to the dashboard
              (forceRedirectUrl), so it never lands back on this onboarding page. */}
          <div className="mt-4 border-t border-stone-100 pt-4 text-center">
            <p className="text-sm text-stone-500">Already set up your page?</p>
            <button
              onClick={() => setLoginOpen(true)}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              <LogIn className="h-4 w-4" /> Log in
            </button>
          </div>
        </div>
      )}

      {step === "who" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-stone-900">Tell us who you are</h1>
          <p className="text-sm text-stone-500">A few quick details — no password, no email.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isArtist ? "Your name or stage name" : "Your name"} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm" />
          {!isArtist && (
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm">
              {["Owner", "Manager", "Team member"].map((r) => <option key={r}>{r}</option>)}
            </select>
          )}
          {isArtist && (
            <>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City you're based in (e.g. San Francisco)" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm" />
              <input value={igHandle} onChange={(e) => setIgHandle(e.target.value)} placeholder="Instagram handle (optional) — helps us look you up" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm" />
            </>
          )}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="🇺🇸 +1 (415) 555-0132" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm" />
          <button onClick={sendPhoneCode} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Text me a code
          </button>
          <p className="text-xs text-stone-400">Your number signs you in — it isn&apos;t how we verify the business.</p>
        </div>
      )}

      {step === "code1" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-stone-900">Confirm your number</h1>
          <p className="text-sm text-stone-500">A code to sign you in — we texted {phone}.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Enter the 6-digit code" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-center text-lg tracking-widest" />
          <button onClick={confirmPhoneCode} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm &amp; continue
          </button>
          <p className="text-xs text-stone-400">This signs you in. {isArtist ? "" : "Next we verify the business itself."}</p>
        </div>
      )}

      {step === "business" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-stone-900">Find your business on Google</h1>
          <p className="text-sm text-stone-500">We verify against your real Google listing — and read the number straight from it.</p>
          <div className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2.5">
            <Search className="h-4 w-4 text-stone-400" />
            <input value={pq} onChange={(e) => searchBiz(e.target.value)} placeholder="Search your business" className="w-full text-sm outline-none" />
            {(searching || busy) && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
          </div>
          {results.map((r) => (
            <button key={r.placeId} onClick={() => useListing(r)} disabled={busy} className="flex w-full flex-col items-start rounded-lg border border-stone-200 px-3 py-2 text-left hover:bg-stone-50 disabled:opacity-50">
              <span className="text-sm font-medium text-stone-900">{r.name}</span>
              <span className="text-xs text-stone-500">{r.address}</span>
            </button>
          ))}
          <p className="text-xs text-stone-400">Typed numbers aren&apos;t accepted — only what Google lists.</p>
        </div>
      )}

      {step === "code2" && (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-stone-900">Verify you run {bizName}</h1>
          <p className="text-sm text-stone-500">A different code — to the number on {bizName}&apos;s Google listing{phoneHint ? ` (${phoneHint})` : ""}, not your phone.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Enter the 6-digit code" className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-center text-lg tracking-widest" />
          <button onClick={confirmOwnership} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify ownership
          </button>
          <p className="text-xs text-stone-400">Only someone who can receive at the business&apos;s own line can pass this.</p>
        </div>
      )}

      {step === "working" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          <p className="text-sm text-stone-500">Setting up your page…</p>
        </div>
      )}

      {step === "interview" && (
        <JoinInterview memberId={memberId} bizName={bizName} kind={kind} seed={seed} onDone={() => setStep("done")} />
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">You&apos;re verified · live on WhatsLocal</h1>
          <p className="text-sm text-stone-500">{bizName} is set up. Pick how you want to participate — start free, upgrade anytime.</p>
          <div className="space-y-2 pt-2 text-left">
            <a href="/vendor" className="block rounded-xl border border-stone-200 p-4 hover:bg-stone-50"><b className="text-stone-900">Free</b> — your page + discovery <span className="float-right text-stone-500">$0</span></a>
            <a href="/vendor/billing" className="block rounded-xl border border-stone-200 p-4 hover:bg-stone-50"><b className="text-stone-900">Member</b> — AI agent + collab invites <span className="float-right text-stone-500">$10/mo</span></a>
            <a href="/vendor/billing" className="block rounded-xl border-2 border-violet-400 p-4 hover:bg-violet-50"><b className="text-stone-900">Pro</b> — matching, events, booking agent, sell <span className="float-right text-stone-500">$30/mo</span></a>
          </div>
          <button onClick={() => router.push("/vendor")} className="mt-2 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white">
            Go to your dashboard <ArrowRight className="h-4 w-4" />
          </button>
          <div>
            <button onClick={() => router.push(`/members/${memberId}`)} className="text-sm font-medium text-stone-500 underline hover:text-stone-800">
              or see your public page
            </button>
          </div>
        </div>
      )}

      {loginOpen && <VendorPhoneLogin onClose={() => setLoginOpen(false)} redirectUrl="/vendor" />}
    </div>
  );
}
