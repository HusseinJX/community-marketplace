"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Video, QrCode, X, Radio, Store, CalendarDays, Loader2, MapPin, Tag, Check, Plus } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { listMembers, listEvents } from "@/lib/api";
import { getUserPosition } from "@/lib/native-geo";
import type { Member, EventSuggestion } from "@/lib/types";
import { eventEmoji, eventLabel } from "@/lib/live-events";
import { partitionFixtures, getFixtures, startsInLabel, type Fixture } from "@/lib/live-fixtures";

const VENDOR_MODE_KEY = "wl_vendor_mode";
interface Media {
  url: string;
  kind: "image" | "video";
}
type TagItem = { kind: "business" | "event"; id: string; label: string };
type TagSlot = { query: string; tag: TagItem | null };

export function ShareComposer() {
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [livestreamUrl, setLivestreamUrl] = useState("");
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventSuggestion[]>([]);

  // Combined tagging (same in shopper + vendor mode): one "business / event" bar
  // per row; the "+" adds another row. Each slot holds its query + picked tag.
  const [slots, setSlots] = useState<TagSlot[]>([{ query: "", tag: null }]);
  const [scanSlot, setScanSlot] = useState<number | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Vendor-only "Go Live" — gated behind a dev toggle (persisted) so it can be
  // tested without full vendor auth for now.
  const [vendorMode, setVendorMode] = useState(false);
  const [goLive, setGoLive] = useState(false);
  const [eventSlug, setEventSlug] = useState("nba");
  const [whatsOn, setWhatsOn] = useState("");
  const [supportsTeam, setSupportsTeam] = useState("");
  const [pickedFixture, setPickedFixture] = useState<string | null>(null);
  const [tournFilter, setTournFilter] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(0);
  // Real games on now (ESPN via /api/fixtures); seeded with the fallback slate.
  const [fixtures, setFixtures] = useState<Fixture[]>(() => getFixtures());

  useEffect(() => {
    // Vendor mode (Go Live) is on ONLY when arriving from the vendor portal
    // (?vendor=1). It is not persisted — a shopper opening /share from the top
    // nav never sees it. Clear any legacy stored flag so it stops sticking.
    localStorage.removeItem(VENDOR_MODE_KEY);
    setVendorMode(new URLSearchParams(window.location.search).get("vendor") === "1");
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Pull the real slate on mount (refresh every few minutes).
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/fixtures");
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.fixtures)) setFixtures(data.fixtures);
      } catch {
        /* keep the seeded slate */
      }
    };
    pull();
    const t = setInterval(pull, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const { live: liveFixtures, upcoming: upcomingFixtures } = partitionFixtures(fixtures, nowTs || Date.now());

  // Group the whole slate by tournament (live first within each group).
  const fixtureGroups = useMemo(() => {
    const tagged = [
      ...liveFixtures.map((f) => ({ f, live: true })),
      ...upcomingFixtures.map((f) => ({ f, live: false })),
    ];
    const map = new Map<string, { f: Fixture; live: boolean }[]>();
    for (const t of tagged) {
      const arr = map.get(t.f.event_slug) ?? [];
      arr.push(t);
      map.set(t.f.event_slug, arr);
    }
    return Array.from(map.entries()).map(([slug, items]) => ({ slug, items }));
  }, [liveFixtures, upcomingFixtures]);

  // Tournament order for the filter pills — World Cup first, then the rest as
  // they appear in the slate.
  const tournamentSlugs = useMemo(() => {
    const slugs = fixtureGroups.map((g) => g.slug);
    return slugs.sort((a, b) => (a === "world-cup" ? -1 : b === "world-cup" ? 1 : 0));
  }, [fixtureGroups]);

  // Default to World Cup when it's on, else show everything.
  const activeTourn =
    tournFilter ?? (tournamentSlugs.includes("world-cup") ? "world-cup" : "all");
  const shownGroups =
    activeTourn === "all" ? fixtureGroups : fixtureGroups.filter((g) => g.slug === activeTourn);

  const pickedGame = fixtures.find((f) => f.id === pickedFixture) ?? null;

  function pickFixture(f: Fixture) {
    setPickedFixture(f.id);
    setEventSlug(f.event_slug);
    setWhatsOn(f.matchup);
    setSupportsTeam(""); // let them pick a side via chips
    setGoLive(true);
  }

  useEffect(() => {
    let cancelled = false;
    listMembers({ limit: 100 })
      .then((r) => { if (!cancelled && r.members?.length) setMembers(r.members); })
      .catch(() => {});
    listEvents({ limit: 100 })
      .then((r) => { if (!cancelled && r.events?.length) setEvents(r.events); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Pre-tag from the URL (e.g. "Post a memory" from an event page:
  // /share?event=<id>&eventTitle=<name>) → seeds the combined tag rows.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ev = p.get("event");
    const biz = p.get("business");
    const pre: TagSlot[] = [];
    if (biz) pre.push({ query: "", tag: { kind: "business", id: biz, label: p.get("businessName") || "this business" } });
    if (ev) pre.push({ query: "", tag: { kind: "event", id: ev, label: p.get("eventTitle") || "this event" } });
    if (pre.length) setSlots(pre);
  }, []);

  // Combined search over businesses + events for a single tag bar.
  function searchTags(q: string): TagItem[] {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const biz: TagItem[] = members
      .filter((m) => (m.profile?.name ?? "").toLowerCase().includes(s))
      .slice(0, 5)
      .map((m) => ({ kind: "business", id: m.id, label: m.profile?.name ?? "Business" }));
    const evt: TagItem[] = events
      .filter((e) => (e.title ?? "").toLowerCase().includes(s))
      .slice(0, 5)
      .map((e) => ({ kind: "event", id: e.id, label: e.title ?? "Event" }));
    return [...biz, ...evt].slice(0, 8);
  }

  const setSlotQuery = (i: number, q: string) =>
    setSlots((arr) => arr.map((sl, j) => (j === i ? { ...sl, query: q } : sl)));
  const selectSlotTag = (i: number, tag: TagItem) =>
    setSlots((arr) => arr.map((sl, j) => (j === i ? { query: "", tag } : sl)));
  const clearSlotTag = (i: number) =>
    setSlots((arr) => arr.map((sl, j) => (j === i ? { query: "", tag: null } : sl)));
  const addSlot = (i: number) =>
    setSlots((arr) => {
      const c = [...arr];
      c.splice(i + 1, 0, { query: "", tag: null });
      return c;
    });
  const removeSlot = (i: number) =>
    setSlots((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr));

  // First business / event tag across the rows (the post + broadcast schemas each
  // carry one of each).
  const bizTag = slots.find((s) => s.tag?.kind === "business")?.tag ?? null;
  const evTag = slots.find((s) => s.tag?.kind === "event")?.tag ?? null;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/share/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) setMedia((m) => [...m, { url: data.url, kind: data.kind }]);
        else setError(data.error ?? "Upload failed");
      } catch {
        setError("Upload failed");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function useCurrentLocation() {
    setLocating(true);
    setLocError(null);
    try {
      const [lat, lng] = await getUserPosition();
      // Reverse-geocode to a readable neighborhood label; fall back to coords.
      let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      try {
        const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.label) label = data.label;
        }
      } catch {
        /* keep coords fallback */
      }
      setLocation(label);
    } catch {
      setLocError("Couldn't get your location. Check location permissions.");
    }
    setLocating(false);
  }

  function onScan(kind: "business" | "event", id: string) {
    const label =
      kind === "event"
        ? events.find((x) => x.id === id)?.title ?? "Event"
        : members.find((x) => x.id === id)?.profile?.name ?? "Business";
    if (scanSlot != null) {
      selectSlotTag(scanSlot, { kind, id, label });
      setScanSlot(null);
    }
    setScannerOpen(false);
  }

  async function goLiveSubmit() {
    if (!bizTag) {
      setError("Tag your venue to go live for it.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/broadcasts/${bizTag.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName: bizTag.label,
          event_slug: eventSlug,
          whats_on: whatsOn.trim() || null,
          note: body.trim() || null,
          supports_team: supportsTeam.trim() || null,
          livestream_url: livestreamUrl.trim() || null,
          image_urls: media.filter((m) => m.kind === "image").map((m) => m.url),
          // Broadcast runs until the match ends (from the fixture); fall back to
          // ~3h if somehow no game is picked.
          duration_minutes: pickedGame
            ? Math.max(30, Math.round((Date.parse(pickedGame.ends_at) - Date.now()) / 60000))
            : 180,
        }),
      });
      if (res.ok) {
        setBody("");
        setMedia([]);
        setLivestreamUrl("");
        setWhatsOn("");
        setSupportsTeam("");
        setPickedFixture(null);
        setGoLive(false);
        setSlots([{ query: "", tag: null }]);
        setPosted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to go live");
      }
    } catch {
      setError("Failed to go live");
    }
    setPosting(false);
  }

  async function submit() {
    if (goLive) return goLiveSubmit();
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          imageUrls: media.filter((m) => m.kind === "image").map((m) => m.url),
          videoUrls: media.filter((m) => m.kind === "video").map((m) => m.url),
          taggedMemberId: bizTag?.id ?? null,
          taggedMemberName: bizTag?.label ?? null,
          taggedEventId: evTag?.id ?? null,
          taggedEventTitle: evTag?.label ?? null,
          livestreamUrl: livestreamUrl.trim() || null,
          location: location.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.post) {
        setBody("");
        setMedia([]);
        setLivestreamUrl("");
        setLocation("");
        setLocError(null);
        setSlots([{ query: "", tag: null }]);
        setPosted(true);
      } else {
        setError(data.error ?? "Failed to post");
      }
    } catch {
      setError("Failed to post");
    }
    setPosting(false);
  }

  const canPost = goLive
    ? !!bizTag && !!eventSlug
    : body.trim() || media.length > 0 || livestreamUrl.trim();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Share</h1>
      </div>

      {posted && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>Shared! 🎉</span>
          <button type="button" onClick={() => setPosted(false)} className="font-medium underline">
            Post another
          </button>
        </div>
      )}

      {/* Go Live — vendor only */}
      {vendorMode && (
        <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <button
            type="button"
            onClick={() => setGoLive((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <Radio className="h-4 w-4" /> Go live
            </span>
            <span
              className={
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
                (goLive ? "bg-rose-500" : "bg-stone-300")
              }
            >
              <span
                className={
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
                  (goLive ? "translate-x-5" : "translate-x-0.5")
                }
              />
            </span>
          </button>

          {goLive && (
            <div className="space-y-3">
              {/* Pick a real game — filter by tournament (World Cup first). */}
              {fixtureGroups.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-stone-500">
                    What&apos;s on — pick a game
                  </label>

                  {/* Tournament filter pills */}
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {tournamentSlugs.map((slug) => (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => setTournFilter(slug)}
                        className={
                          "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                          (activeTourn === slug
                            ? "bg-rose-600 text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300")
                        }
                      >
                        {eventEmoji(slug)} {eventLabel(slug)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTournFilter("all")}
                      className={
                        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                        (activeTourn === "all"
                          ? "bg-rose-600 text-white"
                          : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300")
                      }
                    >
                      All
                    </button>
                  </div>

                  {shownGroups.map((g) => (
                    <div key={g.slug}>
                      {activeTourn === "all" && (
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                          {eventEmoji(g.slug)} {eventLabel(g.slug)}
                        </p>
                      )}
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {g.items.map(({ f, live }) => (
                          <FixtureChip
                            key={f.id}
                            f={f}
                            live={live}
                            picked={pickedFixture === f.id}
                            onPick={() => pickFixture(f)}
                            when={live ? undefined : startsInLabel(f.starts_at, nowTs || Date.now())}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rooting for? — quick chips for the picked game's two teams. */}
              {pickedGame?.teams && pickedGame.teams.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-500">Rooting for? (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {pickedGame.teams.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSupportsTeam((cur) => (cur === t ? "" : t))}
                        className={
                          "rounded-full px-3.5 py-1.5 text-sm font-medium transition " +
                          (supportsTeam === t
                            ? "bg-rose-600 text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300")
                        }
                      >
                        🏳️ {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bizTag && (
                <p className="text-xs text-stone-500">Going live as {bizTag.label}.</p>
              )}
            </div>
          )}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={goLive ? "Add a vibe note (optional)…" : "What's happening locally?"}
        className="w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 text-base text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none"
      />

      {/* Media previews */}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              {m.kind === "image" ? (
                <Image src={m.url} alt="" fill sizes="33vw" className="object-cover" />
              ) : (
                <video src={m.url} className="h-full w-full object-cover" muted />
              )}
              <button
                type="button"
                onClick={() => setMedia((arr) => arr.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <ToolButton onClick={() => fileRef.current?.click()} icon={ImagePlus} label="Photo" />
        <ToolButton onClick={() => fileRef.current?.click()} icon={Video} label="Video" />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>

      {/* Livestream link */}
      <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
        <Radio className="h-4 w-4 shrink-0 text-rose-500" />
        <input
          value={livestreamUrl}
          onChange={(e) => setLivestreamUrl(e.target.value)}
          placeholder="Livestream link (YouTube / Twitch)"
          className="w-full bg-transparent py-2.5 text-base text-stone-900 placeholder-stone-400 focus:outline-none"
        />
      </label>

      {/* Location — users only (a vendor's broadcast location is their tagged
          venue). Tap to capture the device's current spot; no typing. */}
      {!vendorMode && (
        <div>
          {location ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="flex-1 truncate text-sm font-medium text-emerald-800">
                Location set · {location}
              </span>
              <button
                type="button"
                onClick={() => setLocation("")}
                aria-label="Clear location"
                className="text-emerald-500 hover:text-emerald-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-base text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              {locating ? "Getting your location…" : "Use current location"}
            </button>
          )}
          {locError && <p className="mt-1 text-xs text-rose-600">{locError}</p>}
        </div>
      )}

      {/* Combined "business / event" tag bars — same in shopper + vendor mode.
          Each row has a QR button; the "+" adds another row below. In vendor
          mode the first business tag is the venue you go live as. */}
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <TagRow
            key={i}
            slot={slot}
            results={searchTags(slot.query)}
            isLast={i === slots.length - 1}
            onQuery={(q) => setSlotQuery(i, q)}
            onSelect={(t) => selectSlotTag(i, t)}
            onClear={() => clearSlotTag(i)}
            onScan={() => { setScanSlot(i); setScannerOpen(true); }}
            onAdd={() => addSlot(i)}
            onRemove={slots.length > 1 ? () => removeSlot(i) : undefined}
          />
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        disabled={!canPost || posting || uploading}
        onClick={submit}
        className="w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
      >
        {posting ? (goLive ? "Going live…" : "Sharing…") : goLive ? "Go live" : "Share"}
      </button>

      {scannerOpen && (
        <ScannerModal
          onScan={onScan}
          onClose={() => { setScannerOpen(false); setScanSlot(null); }}
        />
      )}
    </div>
  );
}

function FixtureChip({
  f, live, picked, onPick, when,
}: {
  f: Fixture;
  live: boolean;
  picked: boolean;
  onPick: () => void;
  when?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={
        "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition " +
        (picked ? "border-rose-500 bg-rose-50 ring-1 ring-rose-400" : "border-stone-200 bg-white hover:border-rose-300")
      }
    >
      <span className="text-lg leading-none">{eventEmoji(f.event_slug)}</span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-sm font-medium text-stone-900">{f.matchup}</span>
        <span className="block text-[11px] font-medium">
          {live ? (
            <span className="inline-flex items-center gap-1 text-rose-600">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> Live now
            </span>
          ) : (
            <span className="text-stone-500">{when}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function ToolButton({
  onClick, icon: Icon, label, active,
}: { onClick: () => void; icon: typeof ImagePlus; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition " +
        (active
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50")
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// One combined "business / event" tag row: search bar (or picked-tag chip) plus
// a QR scan button and, on the last row, a "+" that appends another row.
function TagRow({
  slot, results, isLast, onQuery, onSelect, onClear, onScan, onAdd, onRemove,
}: {
  slot: TagSlot;
  results: TagItem[];
  isLast: boolean;
  onQuery: (v: string) => void;
  onSelect: (t: TagItem) => void;
  onClear: () => void;
  onScan: () => void;
  onAdd: () => void;
  onRemove?: () => void;
}) {
  const squareBtn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50";
  return (
    <div className="flex items-start gap-2">
      <div className="relative flex-1">
        {slot.tag ? (
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
            {slot.tag.kind === "event" ? (
              <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
            ) : (
              <Store className="h-4 w-4 shrink-0 text-indigo-500" />
            )}
            <span className="flex-1 truncate text-sm font-medium text-stone-800">{slot.tag.label}</span>
            <button type="button" onClick={onClear} aria-label="Remove tag" className="text-stone-400 hover:text-stone-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
              <Tag className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                value={slot.query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Tag business / event"
                className="w-full bg-transparent py-2.5 text-base text-stone-900 placeholder-stone-400 focus:outline-none"
              />
            </div>
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                {results.map((r) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    onClick={() => onSelect(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100"
                  >
                    {r.kind === "event" ? (
                      <CalendarDays className="h-4 w-4 shrink-0 text-stone-400" />
                    ) : (
                      <Store className="h-4 w-4 shrink-0 text-stone-400" />
                    )}
                    <span className="flex-1 truncate">{r.label}</span>
                    <span className="text-[11px] uppercase tracking-wide text-stone-400">
                      {r.kind === "event" ? "Event" : "Business"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <button type="button" onClick={onScan} aria-label="Scan QR to tag" className={squareBtn}>
        <QrCode className="h-5 w-5" />
      </button>
      {isLast ? (
        <button type="button" onClick={onAdd} aria-label="Add another tag" className={squareBtn}>
          <Plus className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this tag row"
          className={squareBtn + " text-stone-400 hover:text-stone-700"}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function ScannerModal({
  onScan,
  onClose,
}: {
  onScan: (kind: "business" | "event", id: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (res) => {
          if (res && !cancelled) {
            try {
              const u = new URL(res.getText());
              const biz = u.pathname.match(/\/members\/([^/]+)/);
              const evt = u.pathname.match(/\/(?:events|live)\/([^/]+)/);
              if (biz) {
                controlsRef.current?.stop();
                onScan("business", biz[1]);
              } else if (evt) {
                controlsRef.current?.stop();
                onScan("event", evt[1]);
              }
            } catch {
              /* ignore non-URL codes */
            }
          }
        });
        controlsRef.current = controls;
      } catch {
        if (!cancelled) setError("Camera unavailable. Needs HTTPS or localhost.");
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onScan]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 px-4 pb-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="flex justify-end pr-1">
        <button onClick={onClose} aria-label="Close scanner" className="rounded-full bg-white/20 p-2.5 text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {error ? (
          <p className="max-w-xs text-center text-sm text-white/80">{error}</p>
        ) : (
          <video ref={videoRef} className="max-h-[70vh] w-full max-w-sm rounded-2xl object-cover" muted playsInline />
        )}
      </div>
      <p className="pb-4 text-center text-sm text-white/70">Scan a business or event QR code to tag it</p>
    </div>
  );
}
