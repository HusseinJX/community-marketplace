"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { VendorPhoneLogin } from "@/components/auth/VendorPhoneLogin";
import { Store, Users, Mic, Search, Loader2, Check, ArrowRight, ArrowLeft, LogOut, LogIn, UserRound, ShieldCheck } from "lucide-react";
import { JoinInterview } from "@/components/join/JoinInterview";
import { LinksStep } from "@/components/join/LinksStep";
import { ShopSetup } from "@/components/join/ShopSetup";
import type { StoredLink } from "@/lib/links";
import { GoogleIcon, AppleIcon } from "@/components/auth/OAuthBrandIcons";
import { useIsNativeApp, isNativeApp } from "@/lib/native";
import { nativeGoogleSignIn } from "@/lib/native-auth";
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
type Step = "type" | "who" | "business" | "code2" | "working" | "links" | "interview" | "done" | "setup";

const TYPES: { key: Kind; icon: typeof Store; label: string; sub: string }[] = [
  { key: "vendor", icon: Store, label: "A business or vendor", sub: "Shop, bar, restaurant, maker" },
  { key: "organizer", icon: Users, label: "A community organization", sub: "Nonprofit, collective, org" },
  { key: "artist", icon: Mic, label: "An artist or performer", sub: "DJ, musician, creator" },
];

/**
 * The top of every step: a circle icon, the QUESTION as the title, one grey
 * line under it.
 *
 * Lifted from ProLocal IQ's onboarding cards, at Airbnb's scale. Two things
 * change versus what was here before, and both matter more than they look:
 *
 *  - The title IS the question ("What are you setting up?"), not a label for
 *    one ("Join WhatsLocal" with the question demoted to grey sub-text). You
 *    read the big text first, so the big text has to be the thing being asked.
 *  - 28px, not 20px. One question per screen only works if the question is
 *    unmissable; at `text-xl` it read as a section heading on a form.
 */
function StepHeader({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Store;
  title: string;
  sub: string;
}) {
  return (
    <header>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral-50">
        <Icon className="h-7 w-7 text-coral-600" />
      </div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-stone-900">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-500">{sub}</p>
    </header>
  );
}


// The links we already know from the listing, as rows the person can edit.
// Order matters — it is the order they appear in on the step.
function seedFromListing(details: { website?: string | null; phone?: string | null } | null | undefined): StoredLink[] {
  const out: StoredLink[] = [];
  if (details?.website) out.push({ id: "website", value: details.website });
  if (details?.phone) out.push({ id: "phone", value: details.phone });
  return out;
}

/**
 * A chosen Google listing, resolved but not yet claimed.
 *
 * `profile` is what /api/members/create will be handed, `seed` is the warm
 * baseline for the interview, `links` the prefilled website + phone. All three
 * are built from the single details call made when the listing was tapped.
 */
interface Picked {
  placeId: string;
  name: string;
  profile: Record<string, unknown>;
  seed: BriefInput;
  links: StoredLink[];
  phoneHint: string | null;
}

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
  const native = useIsNativeApp(); // iOS: hide subscription prices (Apple 3.1.1)
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
  // `code` is the BUSINESS-verification OTP (step "code2") — the only place phone
  // is used. Account sign-in/sign-up is Google/Apple only (email-based).
  const [code, setCode] = useState("");

  // Once the person has started creating their account (OAuth or phone), signing
  // in flips useAuth().isSignedIn to true — but that must NOT bounce them to the
  // "log out first" screen mid-flow. That guard is only for people who LAND here
  // already signed in, so it's suppressed once the flow is underway. Initialize
  // true when returning from the in-app Apple redirect (a resume is pending), so
  // the guard never flashes before the resume effect runs.
  const [midFlow, setMidFlow] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return !!sessionStorage.getItem("join_apple_resume"); } catch { return false; }
  });

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

  // Artist-only extra. No Maps anchor to key research off, so the city is what
  // tells the web search which "Maya" it is looking for. Their handles are
  // asked for later, on the links step.
  //
  // `remote` is the honest answer for the people this question doesn't fit — a
  // producer who works online, a touring act with no home scene. Ticked, the
  // city question disappears rather than being asked and ignored, and nothing
  // is sent: a made-up city is worse than none, because the research would key
  // off it and confidently find the wrong person.
  const [city, setCity] = useState("");
  const [remote, setRemote] = useState(false);

  // "What we already know" baseline handed to the onboarding interview so it
  // opens warm — set from the Google Places pick (entities) or the artist form.
  const [seed, setSeed] = useState<BriefInput>({});

  // What the links step opens with. Never a blank list when we already paid
  // for the answer: the website AND the phone number both come free with the
  // details call we already make.
  //
  // The PHONE is the one we just verified them against — the number on their
  // own Google listing, which they proved they can answer. It is the single
  // most useful thing on a local business's page and the one they are most
  // likely to leave blank, so it arrives already filled in. As an ordinary
  // editable row, though: plenty of businesses answer enquiries on a different
  // line from the one Google lists, and this must not overwrite that decision
  // silently.
  const [linkSeed, setLinkSeed] = useState<StoredLink[]>([]);

  // The listing they picked, held between the search and the sign-in that
  // claims it. Everything in here came from the ONE details call we already
  // paid for, so it is carried rather than re-fetched — and it is plain JSON,
  // which is what lets the Apple redirect stash and restore it.
  const [picked, setPicked] = useState<Picked | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isArtist = kind === "artist";

  // ── Step 1: type ──────────────────────────────────────────────────────────
  //
  // WHERE SIGN-IN SITS, and why it moved (2026-08-13).
  //
  // It used to be step 2: name, role, Google/Apple — asked before the visitor
  // had seen anything at all. Now an entity searches for its business FIRST and
  // signs in to CLAIM the listing it just found. That is the shape every claim
  // flow worth copying uses (Google Business Profile most obviously): the ask
  // lands at the moment of motivation, when your own address and rating are on
  // screen and the button says "this is us", instead of at a blank name field.
  // The search itself needs no session — /api/places/search is public — so
  // nothing is lost by waiting.
  //
  // It could not move any LATER than this. Everything past the search is 401
  // without a session: members/create, otp, claim, vendor/profile all check
  // auth() first, and the links step and interview write through resolveActor,
  // which is owner-only. "Collect everything, sign in at the end" would mean
  // burning an ownership SMS on an anonymous visitor and holding the whole
  // interview in browser memory with nothing persisted.
  //
  // Artists have no listing to find, so for them sign-in stays where it was —
  // immediately after their name.
  function pickType(k: Kind) {
    setKind(k);
    setStep(k === "artist" ? "who" : "business");
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
    // The chosen listing is transient state too — starting over as an artist
    // while a bakery is still selected is exactly the pollution this clears.
    setPicked(null);
  }

  // In-app Apple sign-in uses a full redirect (the native token strategy is
  // gated to Clerk's native SDK, and Google-style popups don't work in WKWebView).
  // A redirect drops this page's in-memory state, so oauthSignUp stashes it and we
  // restore + advance here once we're back and signed in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("join_apple_resume"); } catch { /* ignore */ }
    if (!raw) return;
    try { sessionStorage.removeItem("join_apple_resume"); } catch { /* ignore */ }
    let s: { kind?: Kind; name?: string; role?: string; city?: string; picked?: Picked | null };
    try { s = JSON.parse(raw); } catch { return; }
    const k: Kind = s.kind ?? "vendor";
    setKind(k);
    setName(s.name ?? "");
    setRole(s.role ?? "Owner");
    setCity(s.city ?? "");
    setMidFlow(true);
    setStep("working");
    // Values are passed explicitly — the setState calls above haven't flushed.
    if (k === "artist") {
      void finishArtist({ name: s.name ?? "", city: s.city ?? "" });
    } else if (s.picked) {
      // The chosen listing survives the redirect too. Without it the person
      // would come back signed in and be asked to find their business again,
      // having already found it.
      setPicked(s.picked);
      setBizName(s.picked.name);
      setSeed(s.picked.seed);
      setLinkSeed(s.picked.links);
      void claimPicked({ pick: s.picked, name: s.name ?? "", role: s.role ?? "Owner" });
    } else {
      setStep("business");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  // Advance past sign-in. Artists (self-owned) go straight to setup; an entity
  // now has a session AND a listing, so this is where the member is created and
  // the ownership code goes out.
  function afterSignedIn() {
    setStep("working");
    if (isArtist) void finishArtist();
    else void claimPicked();
  }

  // ── Step 2 (primary): sign in with Google / Apple (Clerk OAuth popup) ───────
  // A popup keeps this page — and all its in-memory state (kind, name, the
  // business you picked) — alive; a full redirect would drop it and dump the
  // person back at step 1. /sso-callback completes the flow inside the popup and
  // sets the session on the shared client, then the promise below resolves.
  async function oauthSignUp(strategy: "oauth_google" | "oauth_apple") {
    if (!name.trim()) return setErr(isArtist ? "Add your name or stage name." : "Add your name.");
    setErr("");
    // DEMO: no real OAuth — behave like a completed sign-in.
    if (demo) {
      setMidFlow(true);
      afterSignedIn();
      return;
    }
    // Already signed in (e.g. logged in via Google a moment ago)? Skip straight on.
    if (isSignedIn) {
      setMidFlow(true);
      afterSignedIn();
      return;
    }
    // Inside the iOS app the web popup is blocked (WKWebView):
    //  • Apple — oauth_apple REDIRECT (kept inside the webview; Apple permits its
    //    sign-in there). The native token strategy 401s from the web SDK. Redirect
    //    drops our state, so stash it and resume via the effect above.
    //  • Google — native plugin token (Google blocks webview OAuth).
    if (isNativeApp()) {
      if (strategy === "oauth_apple") {
        try {
          sessionStorage.setItem("join_apple_resume", JSON.stringify({ kind, name, role, city, picked }));
        } catch { /* ignore */ }
        setBusy(true);
        try {
          await clerk.client.signIn.authenticateWithRedirect({
            strategy: "oauth_apple",
            redirectUrl: `${window.location.origin}/sso-callback`,
            redirectUrlComplete: `${window.location.origin}/join`,
          });
          // Redirect navigates away; nothing after this runs.
        } catch (e) {
          try { sessionStorage.removeItem("join_apple_resume"); } catch { /* ignore */ }
          setBusy(false);
          setErr(e instanceof Error ? e.message : "Couldn't start Apple sign-in.");
        }
        return;
      }
      setBusy(true);
      setMidFlow(true);
      try {
        await nativeGoogleSignIn(clerk);
        afterSignedIn();
      } catch (e) {
        setMidFlow(false);
        setErr(e instanceof Error ? e.message : "Couldn't sign in with that provider.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setMidFlow(true);
    // The popup must be opened synchronously inside the click handler or the
    // browser blocks it; Clerk then drives it to the provider and back.
    const popup = window.open("", "_blank", "width=520,height=640");
    try {
      await clerk.client.signUp.authenticateWithPopup({
        strategy,
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/join`,
        continueSignUp: true,
        popup,
      });
      // Popup resolved — the shared client now holds the session. Guard against a
      // Clerk instance still requiring extra fields (would leave us un-signed-in).
      if (!clerk.session && clerk.client.signUp.status !== "complete") {
        throw new Error("Couldn't finish sign-in. Make sure the popup wasn't blocked.");
      }
      afterSignedIn();
    } catch (e) {
      setMidFlow(false);
      try { popup?.close(); } catch {}
      const msg = e instanceof Error ? e.message : "";
      setErr(/cancel|closed|abort/i.test(msg) ? "Sign-in was cancelled." : msg || "Couldn't sign in with that provider.");
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

  // Pick a listing → resolve it → go and sign in. NOTHING is created here any
  // more: the member, the claim and the OTP all need a session, and this runs
  // before there is one. All this does is spend the one details call and hold
  // the answer.
  async function chooseListing(p: Place) {
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
        // ownerName/ownerRole are filled in at claim time — at this point we
        // still don't know who they are.
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

      const pick: Picked = {
        placeId: p.placeId,
        name: p.name,
        profile,
        seed: listingSeed,
        links: seedFromListing(details),
        phoneHint: maskPhone(details?.phone),
      };
      setPicked(pick);
      setBizName(p.name);
      setSeed(listingSeed);
      setLinkSeed(pick.links);
      setStep("who");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Signed in, with a listing in hand: create the member from it and send the
  // ownership code. `override` exists for the Apple redirect, whose restored
  // state hasn't flushed through setState by the time this runs.
  async function claimPicked(override?: { pick: Picked; name: string; role: string }) {
    const pick = override?.pick ?? picked;
    if (!pick) {
      // No listing to claim — the only way here is a resume that lost it.
      setStep("business");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      // Who they are is known NOW and not before, so it is stamped on at claim
      // time rather than baked into the profile at search time.
      const profile = {
        ...pick.profile,
        ownerName: override?.name ?? name,
        ownerRole: override?.role ?? role,
      };

      // DEMO: no member created, no OTP sent. Show the business's REAL Google
      // listing number as the (fake) verify target and move on.
      if (demo) {
        setMemberId("demo-join");
        setPhoneHint(pick.phoneHint);
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
      // Send the ownership code to the listing's phone.
      const otp = await (await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: created.memberId }),
      })).json();
      if (!otp.sent) {
        setErr(otp.error || "This listing has no phone we can verify. Try a different listing or ask an admin.");
        setStep("business"); // back to the search, with the error explaining why
        return;
      }
      setPhoneHint(otp.phoneHint || null);
      setStep("code2");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setStep("business");
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
        setStep("links");
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
      // Links come BEFORE the interview: they are typing, the interview is
      // talking, and the interview is the long one. Asking for links after it
      // meets someone who has just finished and thinks they are done.
      setStep("links");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That code didn't match.");
    } finally {
      setBusy(false);
    }
  }

  // ── Artist finish: create self-owned member + link ─────────────────────────
  // `override` lets the Apple-redirect resume pass values that setState hasn't
  // flushed yet; otherwise it reads the live form state.
  async function finishArtist(override?: { name: string; city: string }) {
    const nm = override?.name ?? name;
    const ct = override?.city ?? (remote ? "" : city);
    setBusy(true);
    setErr("");
    try {
      // DEMO: no member created — seed the interview from the artist form and go.
      if (demo) {
        setMemberId("demo-join");
        setBizName(nm);
        setSeed({ name: nm, city: ct.trim() || null });
        setStep("links");
        return;
      }
      const created = await (await fetch("/api/members/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: nm,
            memberType: "artist",
            ownerName: nm,
            city: ct.trim() || undefined,
          },
          mode: "self",
        }),
      })).json();
      if (!created.memberId) throw new Error(created.error || "Couldn't create your page.");
      setMemberId(created.memberId);
      setBizName(nm);
      // Artists have no Maps anchor — the seed (name + city + IG) is what the
      // web-search research keys off to open the interview knowing them.
      setSeed({ name: nm, city: ct.trim() || null });
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
      setStep("links");
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
        <Loader2 className="h-6 w-6 animate-spin text-coral-600" />
      </div>
    );
  }

  // Already signed in (as a shopper or a vendor)? Onboarding needs a clean,
  // logged-out start — log out first, then this same page shows the flow.
  // (Skipped in demo, which runs without any Clerk session.)
  if (isSignedIn && !demo && !midFlow) {
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
      {step !== "type" && step !== "done" && step !== "setup" && (
        <button
          onClick={backToMenu}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to menu
        </button>
      )}
      {step !== "type" && step !== "done" && step !== "interview" && step !== "links" && step !== "setup" && (
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-stone-400">
          {/* The caption follows the ORDER, which changed when sign-in moved
              after the search: for an entity it is now find (1) → claim (2) →
              verify (3). It said "Step 2 of 2 · the business" on the search
              screen, which is the first thing an entity now sees. */}
          {isArtist
            ? "Artist"
            : step === "business"
              ? "Step 1 of 3 · your business"
              : step === "who"
                ? "Step 2 of 3 · your account"
                : "Step 3 of 3 · verify"}
        </p>
      )}
      {err && <p className="mb-4 rounded-lg bg-rose-50 px-3.5 py-2 text-[13px] text-rose-700">{err}</p>}

      {step === "type" && (
        <div className="space-y-6">
          <StepHeader
            icon={Store}
            title="What are you setting up?"
            sub="This decides how we verify you — there's a different check for a place with an address than for a person."
          />
          {/* Tap-cards, not a list. Each one is a decision, so each gets its own
              icon circle, a real title and a sentence that says what it means —
              the shape ProLocal IQ's location step uses, which is the best
              screen in either app. `active:scale-[0.98]` is theirs too: on a
              phone it is the only feedback between the tap and the next screen. */}
          <div className="space-y-3">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => pickType(t.key)}
                className="flex w-full items-center gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 hover:bg-stone-50 active:scale-[0.98] sm:p-5"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-coral-50 sm:h-14 sm:w-14">
                  <t.icon className="h-6 w-6 text-coral-600 sm:h-7 sm:w-7" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-stone-900 sm:text-[17px]">{t.label}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-stone-500">{t.sub}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-stone-300" />
              </button>
            ))}
          </div>
          <p className="text-[13px] text-stone-400">Business &amp; org prove an anchor. Artists are people — self-owned.</p>

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
        <div className="space-y-5">
          <StepHeader
            icon={UserRound}
            title={isArtist ? "What should we call you?" : `Claim ${bizName || "your business"}`}
            sub={
              isArtist
                ? "A couple of details, then continue with Google or Apple."
                : "Tell us who you are, then sign in — this is the account you'll manage the page with."
            }
          />
          {/* What they just picked, shown while they sign in. The listing is the
              reason they are on this screen, and losing sight of it mid-flow is
              how someone ends up wondering whether the tap registered. */}
          {!isArtist && picked && (
            <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white">
                <Store className="h-5 w-5 text-stone-500" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-stone-900">{picked.name}</span>
                <span className="block truncate text-[13px] text-stone-500">
                  {(picked.seed.address as string) || "From your Google listing"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => { setPicked(null); setStep("business"); }}
                className="shrink-0 text-[13px] font-medium text-stone-500 underline underline-offset-2 hover:text-stone-900"
              >
                Change
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-stone-500">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isArtist ? "Your name or stage name" : "Your name"} className="h-13 w-full rounded-xl border border-stone-300 px-4 text-[15px] outline-none transition focus:border-stone-900" />
          </div>
          {!isArtist && (
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-stone-500">Your role at the business</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-13 w-full rounded-xl border border-stone-300 bg-white px-4 text-[15px] outline-none transition focus:border-stone-900">
                {["Owner", "Manager", "Team member"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}
          {/* City only. The Instagram field that sat here is gone (2026-08-13):
              the links step asks for every handle properly, with the real
              brand marks, and asking for one of them on the very first screen
              made a two-field sign-up look like a profile form. City stays
              because it is not a link — an artist has no Maps anchor, so it is
              the only thing telling the research where in the world they are. */}
          {isArtist && (
            <div className="space-y-3">
              {/* The city question hides entirely when they say they're remote —
                  a disabled-but-visible field reads as something you failed to
                  fill in. The toggle stays put so the answer is reversible. */}
              {!remote && (
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-stone-500">Where you&apos;re based</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. San Francisco" className="h-13 w-full rounded-xl border border-stone-300 px-4 text-[15px] outline-none transition focus:border-stone-900" />
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={remote}
                  onChange={(e) => setRemote(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-stone-300 accent-stone-900"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-stone-900">I work remotely</span>
                  <span className="block text-[13px] leading-relaxed text-stone-500">
                    No home city — online, touring, or wherever the work is.
                  </span>
                </span>
              </label>
            </div>
          )}
          {/* Primary: sign in with Google / Apple. */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => oauthSignUp("oauth_google")}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
            </button>
            <button
              onClick={() => oauthSignUp("oauth_apple")}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleIcon />} Continue with Apple
            </button>
          </div>
          <p className="text-xs text-stone-400">
            {isArtist
              ? "You'll finish setting up your page next."
              : "Next we'll send a code to the number on the listing, to check you can answer it."}
          </p>
        </div>
      )}

      {step === "business" && (
        <div className="space-y-5">
          <StepHeader
            icon={Search}
            title="Find your business on Google"
            sub="Search for it the way a customer would. We read your details straight from the listing, so there's no form to fill in."
          />
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
            <button key={r.placeId} onClick={() => chooseListing(r)} disabled={busy} className="flex w-full flex-col items-start rounded-lg border border-stone-200 px-3 py-2 text-left hover:bg-stone-50 disabled:opacity-50">
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
        <div className="space-y-5">
          <StepHeader
            icon={ShieldCheck}
            title={`Verify you run ${bizName}`}
            sub={`A different code — to the number on ${bizName}'s Google listing${phoneHint ? ` (${phoneHint})` : ""}, not your phone.`}
          />
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" className="h-14 w-full rounded-xl border border-stone-300 px-3 text-center text-2xl tracking-[0.3em] outline-none transition focus:border-stone-900" />
          <button onClick={confirmOwnership} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral-600 px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-coral-700 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify ownership
          </button>
          <p className="text-xs text-stone-400">Only someone who can receive at the business&apos;s own line can pass this.</p>
        </div>
      )}

      {step === "working" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-coral-600" />
          <p className="text-sm text-stone-500">Setting up your page…</p>
        </div>
      )}

      {step === "links" && (
        <LinksStep
          memberId={memberId}
          initialLinks={linkSeed}
          demo={demo}
          onDone={() => setStep("interview")}
        />
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

          {/* TWO plans here, not three. The $10 Organizer tier is hidden from
              onboarding (2026-08-13): a middle option at the exact moment
              someone is deciding whether to bother is the one that turns a
              yes-or-no into a comparison, and it is the tier that explains
              itself worst cold — "send invites + host events" means little
              before you have tried to host anything. It still exists in
              lib/entitlements.ts and is still sold on /vendor/billing, which is
              where someone who has hit a limit goes looking. Nothing about
              billing changed; only what this screen offers.

              Native shows NO PRICES (Apple 3.1.1 — in-app prices must come from
              StoreKit, which they do on /vendor/billing via IAP). That branch is
              load-bearing; do not collapse it to save a few lines. */}
          <div className="space-y-2 pt-2 text-left">
            {/* Must match lib/entitlements.ts (FREE_CAN / PRO_CAN). */}
            <button
              onClick={() => setStep("setup")}
              className="block w-full rounded-xl border border-stone-200 p-4 text-left transition hover:bg-stone-50"
            >
              <b className="text-stone-900">Free</b> — your page, posts + event invites
              {!native && <span className="float-right text-stone-500">$0</span>}
            </button>
            {/* Pro goes STRAIGHT to the payment screen. It used to be an <a> to
                /vendor/billing that, mid-onboarding, landed on a page the
                session could not always open yet — from the demo it looked like
                the button did nothing at all. `router.push` keeps the client
                session, and billing is where the purchase legitimately happens
                (Stripe on web, StoreKit natively). */}
            <button
              onClick={() => router.push("/vendor/billing")}
              className="block w-full rounded-xl border-2 border-coral-500 p-4 text-left transition hover:bg-coral-50"
            >
              <b className="text-stone-900">Pro</b> — AI agent + sell online
              {!native && <span className="float-right text-stone-500">$30/mo</span>}
            </button>
          </div>

          <button onClick={() => setStep("setup")} className="mt-2 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800">
            Set up your shop <ArrowRight className="h-4 w-4" />
          </button>
          <div>
            <button onClick={() => router.push("/vendor")} className="text-sm font-medium text-stone-500 underline hover:text-stone-800">
              or skip to your dashboard
            </button>
          </div>
          {/* Auto-renewable subscription disclosure — required (Guideline 3.1.2)
              wherever subscription pricing is presented. Purchase completes on
              /vendor/billing; this screen only advertises the plans + prices. */}
          <div className="mx-auto max-w-md space-y-1.5 pt-2 text-[11px] leading-relaxed text-stone-400">
            <p>
              Paid plans are auto-renewing monthly subscriptions. Payment is charged to your{" "}
              {native ? "Apple ID" : "payment method"} at confirmation and renews unless canceled at
              least 24 hours before the period ends.
            </p>
            <p className="flex items-center justify-center gap-x-3">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">
                Terms of Use (EULA)
              </a>
              <span aria-hidden>·</span>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Setting up the shop — catalogue, then payouts, then what those two
          unlocked. After the plan screen rather than before it, because it is
          the first thing that is about their business rather than about us. */}
      {step === "setup" && (
        <ShopSetup memberId={memberId} demo={demo} onFinish={() => router.push("/vendor")} />
      )}

      {loginOpen && <VendorPhoneLogin onClose={() => setLoginOpen(false)} redirectUrl="/vendor" />}
    </div>
  );
}
