"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { VendorPhoneLogin } from "@/components/auth/VendorPhoneLogin";
import { Store, Users, Mic, Search, Loader2, Check, ArrowRight, ArrowLeft, LogOut, LogIn } from "lucide-react";
import { JoinInterview } from "@/components/join/JoinInterview";
import type { BriefInput } from "@/lib/onboard";
import type { PlaceCandidate } from "@/lib/places";

// Mask a real phone to "(•••) •••-1234" — the demo shows the business's actual
// Google-listing number as the (fake) verify target, same as the real flow.
function maskPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return null;
  return `(•••) •••-${d.slice(-4)}`;
}

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

// The full candidate the search returns — rating, geometry, types and all. It's
// all paid for by that one request, so nothing here gets thrown away: it shows
// on the result row, fills the profile, and warms the interview brief.
type Place = PlaceCandidate;

// `demo` = the repeatable, side-effect-free run of this exact flow (only ever
// passed by the password-gated /joindemo route). Real Google Places (search + the
// real listing phone as the verify target), but the OTPs accept any value, no
// member is created, and the finish is stubbed. Plain /join always passes false,
// so the real onboarding is completely unaffected.
export function JoinFlow({ demo = false }: { demo?: boolean }) {
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
  const [searched, setSearched] = useState(false); // pressed Search at least once

  // Bias Google's ranking to the USER's country, taken from their device.
  // Without a region Google biases on the requesting IP — and the request comes
  // from our server, so a shop in Mexico City would be ranked as if searched
  // from our datacenter. Free signal, no extra call, no prompt.
  const region = useMemo(() => {
    if (typeof navigator === "undefined") return "";
    const m = /[-_]([A-Za-z]{2})$/.exec(navigator.language || "");
    return m ? m[1].toLowerCase() : "";
  }, []);
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

  // Return to the onboarding main menu (the type picker) from any step, clearing
  // the transient step state so a fresh start isn't polluted by the last attempt.
  function backToMenu() {
    setStep("type");
    setErr("");
    setCode("");
    setResults([]);
    setPq("");
  }

  // ── Step 2: who you are → send phone code (Clerk) ──────────────────────────
  async function sendPhoneCode() {
    if (!name.trim()) return setErr("Add your name.");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Add a valid mobile number.");
    setBusy(true);
    setErr("");
    const e164 = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    try {
      // DEMO: no real Clerk sign-in — show the code screen, accept anything.
      if (demo) {
        setPhoneMode("signup");
        setStep("code1");
        return;
      }
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
      // DEMO: any code passes; no Clerk session is created.
      if (demo) {
        setCode("");
        if (isArtist) { setStep("working"); void finishArtist(); }
        else setStep("business");
        return;
      }
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
  // Runs when you press Search (or Enter) — NOT as you type. This used to fire a
  // billed Google Text Search on every keystroke: ~12 calls to type one business
  // name. One deliberate search costs one call, and finds the place just as well.
  async function searchBiz() {
    const q = pq.trim();
    if (q.length < 3 || searching) return;
    setSearching(true);
    try {
      // Bias ranking to where they say they are; otherwise Google ranks around
      // OUR server's IP, and everyone abroad gets our datacenter's city.
      const r = await fetch(
        `/api/places/search?q=${encodeURIComponent(q)}${region ? `&region=${encodeURIComponent(region)}` : ""}`,
      );
      setResults((await r.json()).results || []);
      setSearched(true);
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
      // The interviewer's warm baseline — built from the REAL Places pick either
      // way. Everything here is already bought and paid for by the search + the
      // one details call, so none of it is left on the floor: the rating, the
      // hours and the categories all give the agent something true to open with,
      // which matters most for the many small businesses Google has no editorial
      // summary for.
      const listingSeed: BriefInput = {
        name: p.name,
        category: profile.category ?? null,
        city: details?.city ?? null,
        neighborhood: details?.neighborhood ?? null,
        description: details?.summary ?? null,
        websiteUrl: details?.website ?? null,
        rating: details?.rating ?? p.rating ?? null,
        ratingCount: details?.userRatingsTotal ?? p.userRatingsTotal ?? null,
        hours: details?.hours ?? null,
        types: details?.types ?? p.types ?? null,
        address: details?.address ?? p.address ?? null,
      };

      // DEMO: no member created, no OTP sent. Show the business's REAL Google
      // listing number as the (fake) verify target and move on.
      if (demo) {
        setMemberId("demo-join");
        setBizName(p.name);
        setSeed(listingSeed);
        setPhoneHint(maskPhone(details?.phone));
        setStep("code2");
        return;
      }

      const created = await (await fetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, mode: "self" }),
      })).json();
      if (!created.memberId) throw new Error(created.error || "Couldn't create the profile.");
      setMemberId(created.memberId);
      setBizName(p.name);
      // Baseline the interviewer already knows (Perplexity deepens it on top).
      setSeed(listingSeed);
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
      // DEMO: any code passes; no claim, no profile link.
      if (demo) {
        setCode("");
        setStep("interview");
        return;
      }
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
      // DEMO: no member created — seed the interview from the artist form and go.
      if (demo) {
        setMemberId("demo-join");
        setBizName(name);
        setSeed({ name, city: city.trim() || null, instagramHandle: igClean || null });
        setStep("interview");
        return;
      }
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
  // (Skipped in demo, which runs without any Clerk session.)
  if (isSignedIn && !demo) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
          <LogOut className="h-6 w-6 text-stone-600" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-stone-900">Log out first</h1>
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
      {demo && (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
          Demo — real Google search, no real code, nothing saved
        </p>
      )}
      {step !== "type" && step !== "done" && (
        <button
          onClick={backToMenu}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to menu
        </button>
      )}
      {step !== "type" && step !== "done" && step !== "interview" && (
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-stone-400">
          {isArtist ? "Artist" : step === "business" || step === "code2" ? "Step 2 of 2 · the business" : "Step 1 of 2 · you"}
        </p>
      )}
      {err && <p className="mb-4 rounded-lg bg-rose-50 px-3.5 py-2 text-[13px] text-rose-700">{err}</p>}

      {step === "type" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-stone-900">Join WhatsLocal</h1>
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
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-stone-900">Tell us who you are</h1>
          <p className="text-sm text-stone-500">A few quick details — no password, no email.</p>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-500">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isArtist ? "Your name or stage name" : "Your name"} className="h-12 w-full rounded-xl border border-stone-200 px-4 text-base" />
          </div>
          {!isArtist && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-stone-500">Your role at the business</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-base">
                {["Owner", "Manager", "Team member"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}
          {isArtist && (
            <>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City you're based in (e.g. San Francisco)" className="h-12 w-full rounded-xl border border-stone-200 px-4 text-base" />
              <input value={igHandle} onChange={(e) => setIgHandle(e.target.value)} placeholder="Instagram handle (optional) — helps us look you up" className="h-12 w-full rounded-xl border border-stone-200 px-4 text-base" />
            </>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-500">Mobile number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="🇺🇸 +1 (415) 555-0132" className="h-12 w-full rounded-xl border border-stone-200 px-4 text-base" />
          </div>
          <button onClick={sendPhoneCode} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Text me a code
          </button>
          <p className="text-xs text-stone-400">Your number signs you in — it isn&apos;t how we verify the business.</p>
        </div>
      )}

      {step === "code1" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-stone-900">Confirm your number</h1>
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
          <h1 className="text-xl font-bold text-stone-900">Find your business on Google</h1>
          <p className="text-sm text-stone-500">We verify against your real Google listing — and read the number straight from it.</p>
          {/* Search on submit, never on keystroke — each search is a paid Google
              call. Include the city for a better hit ("Tartine Bakery, SF"). */}
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-stone-300 px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                value={pq}
                onChange={(e) => {
                  setPq(e.target.value);
                  if (searched) { setResults([]); setSearched(false); }
                }}
                onKeyDown={(e) => e.key === "Enter" && searchBiz()}
                placeholder="Business name + city"
                className="w-full text-sm outline-none"
              />
              {(searching || busy) && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-stone-400" />}
            </div>
            <button
              onClick={searchBiz}
              disabled={pq.trim().length < 3 || searching || busy}
              className="shrink-0 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400"
            >
              Search
            </button>
          </div>

          {results.map((r) => (
            <button key={r.placeId} onClick={() => useListing(r)} disabled={busy} className="flex w-full flex-col items-start rounded-lg border border-stone-200 px-3 py-2 text-left hover:bg-stone-50 disabled:opacity-50">
              <span className="text-sm font-medium text-stone-900">{r.name}</span>
              <span className="text-xs text-stone-500">{r.address}</span>
              {/* Already paid for with the search — so show it: it's how you tell
                  two branches of the same name apart. */}
              {(r.rating != null || r.businessStatus === "CLOSED_PERMANENTLY") && (
                <span className="mt-0.5 text-[11px] text-stone-400">
                  {r.rating != null && `★ ${r.rating}${r.userRatingsTotal ? ` (${r.userRatingsTotal})` : ""}`}
                  {r.businessStatus === "CLOSED_PERMANENTLY" && " · Permanently closed"}
                </span>
              )}
            </button>
          ))}

          {searched && results.length === 0 && !searching && (
            <p className="text-xs text-stone-500">
              Nothing found. Try adding the city or neighborhood — e.g. &ldquo;Rosa&apos;s Flowers, Oakland&rdquo;.
            </p>
          )}
          <p className="text-xs text-stone-400">Typed numbers aren&apos;t accepted — only what Google lists.</p>
        </div>
      )}

      {step === "code2" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-stone-900">Verify you run {bizName}</h1>
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
        <JoinInterview memberId={memberId} bizName={bizName} kind={kind} seed={seed} demo={demo} onDone={() => setStep("done")} />
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">You&apos;re verified · live on WhatsLocal</h1>
          <p className="text-sm text-stone-500">{bizName} is set up. Pick how you want to participate — start free, upgrade anytime.</p>
          <div className="space-y-2 pt-2 text-left">
            {/* Must match lib/entitlements.ts (FREE_CAN / MEMBER_CAN / PRO_CAN) — these
                sit next to live prices. Corrected 2026-07-17: Member said "AI agent",
                but textAssistant is PRO_CAN only, so $10 never included it. */}
            <a href="/vendor" className="block rounded-xl border border-stone-200 p-4 hover:bg-stone-50"><b className="text-stone-900">Free</b> — your page, posts + event invites <span className="float-right text-stone-500">$0</span></a>
            <a href="/vendor/billing" className="block rounded-xl border border-stone-200 p-4 hover:bg-stone-50"><b className="text-stone-900">Organizer</b> — send invites + host events <span className="float-right text-stone-500">$10/mo</span></a>
            <a href="/vendor/billing" className="block rounded-xl border-2 border-violet-400 p-4 hover:bg-violet-50"><b className="text-stone-900">Pro</b> — AI agent + sell online <span className="float-right text-stone-500">$30/mo</span></a>
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
