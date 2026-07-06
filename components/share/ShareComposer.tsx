"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Video, QrCode, X, Radio, Store, CalendarDays, Loader2, MapPin } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { listMembers, listEvents } from "@/lib/api";
import type { Member, EventSuggestion } from "@/lib/types";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import { eventEmoji, eventLabel } from "@/lib/live-events";
import { partitionFixtures, getFixtures, startsInLabel, type Fixture } from "@/lib/live-fixtures";

const VENDOR_MODE_KEY = "wl_vendor_mode";
interface Media {
  url: string;
  kind: "image" | "video";
}

export function ShareComposer() {
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [livestreamUrl, setLivestreamUrl] = useState("");
  const [location, setLocation] = useState("");

  const [members, setMembers] = useState<Member[]>(() => DEMO_MEMBERS);
  const [events, setEvents] = useState<EventSuggestion[]>([]);
  const [bizQuery, setBizQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [taggedBiz, setTaggedBiz] = useState<{ id: string; name: string } | null>(null);
  const [taggedEvent, setTaggedEvent] = useState<{ id: string; title: string } | null>(null);

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
    setVendorMode(localStorage.getItem(VENDOR_MODE_KEY) === "1");
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

  function toggleVendorMode() {
    setVendorMode((v) => {
      const next = !v;
      localStorage.setItem(VENDOR_MODE_KEY, next ? "1" : "0");
      if (!next) setGoLive(false);
      return next;
    });
  }

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
  // /share?event=<id>&eventTitle=<name>).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ev = p.get("event");
    if (ev) setTaggedEvent({ id: ev, title: p.get("eventTitle") || "this event" });
    const biz = p.get("business");
    if (biz) setTaggedBiz({ id: biz, name: p.get("businessName") || "this business" });
  }, []);

  const bizResults = useMemo(() => {
    const q = bizQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => (m.profile?.name ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [bizQuery, members]);

  const eventResults = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter((e) => (e.title ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [eventQuery, events]);

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

  function onScan(kind: "business" | "event", id: string) {
    if (kind === "event") {
      const e = events.find((x) => x.id === id);
      setTaggedEvent({ id, title: e?.title ?? "Event" });
    } else {
      const m = members.find((x) => x.id === id);
      setTaggedBiz({ id, name: m?.profile?.name ?? "Business" });
    }
    setScannerOpen(false);
  }

  async function goLiveSubmit() {
    if (!taggedBiz) {
      setError("Tag your venue to go live for it.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/broadcasts/${taggedBiz.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName: taggedBiz.name,
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
          taggedMemberId: taggedBiz?.id ?? null,
          taggedMemberName: taggedBiz?.name ?? null,
          taggedEventId: taggedEvent?.id ?? null,
          taggedEventTitle: taggedEvent?.title ?? null,
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
        setTaggedBiz(null);
        setTaggedEvent(null);
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
    ? !!taggedBiz && !!eventSlug
    : body.trim() || media.length > 0 || livestreamUrl.trim();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Share</h1>
        {/* Vendor dev toggle */}
        <button
          type="button"
          onClick={toggleVendorMode}
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
            (vendorMode
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50")
          }
        >
          <Store className="h-3.5 w-3.5" /> Vendor mode {vendorMode ? "on" : "off"}
        </button>
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

              {/* Ends automatically when the match ends. */}
              {pickedGame && (
                <p className="text-xs text-stone-500">
                  Ends when the match ends
                  {(() => {
                    const mins = Math.round((Date.parse(pickedGame.ends_at) - (nowTs || Date.now())) / 60000);
                    if (!Number.isFinite(mins) || mins <= 0) return "";
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return ` — about ${h ? `${h}h ` : ""}${m}m from now`;
                  })()}
                  .
                </p>
              )}

              <p className="text-xs text-stone-500">
                {taggedBiz
                  ? `Going live as ${taggedBiz.name}.`
                  : "Tag your venue below to go live for it."}
              </p>
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
        {/* Toolbar QR scan — hidden in vendor mode (the business/event Tag
            fields below keep their own Scan buttons). */}
        {!vendorMode && (
          <ToolButton onClick={() => setScannerOpen(true)} icon={QrCode} label="Scan QR" />
        )}
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

      {/* Location tag — users only. A vendor's broadcast location is their
          tagged venue, not a typed one. */}
      {!vendorMode && (
        <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location (e.g. Mission District, SF)"
            className="w-full bg-transparent py-2.5 text-base text-stone-900 placeholder-stone-400 focus:outline-none"
          />
        </label>
      )}

      {/* Tag a business */}
      <TagField
        icon={Store}
        placeholder="Tag a business"
        query={bizQuery}
        setQuery={setBizQuery}
        tagged={taggedBiz?.name}
        onClear={() => setTaggedBiz(null)}
        results={bizResults.map((m) => ({ id: m.id, label: m.profile?.name ?? "Business" }))}
        onSelect={(r) => { setTaggedBiz({ id: r.id, name: r.label }); setBizQuery(""); }}
        extra={
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            <QrCode className="h-3.5 w-3.5" /> Scan
          </button>
        }
      />

      {/* Tag an event */}
      <TagField
        icon={CalendarDays}
        placeholder="Tag an event"
        query={eventQuery}
        setQuery={setEventQuery}
        tagged={taggedEvent?.title}
        onClear={() => setTaggedEvent(null)}
        results={eventResults.map((e) => ({ id: e.id, label: e.title ?? "Event" }))}
        onSelect={(r) => { setTaggedEvent({ id: r.id, title: r.label }); setEventQuery(""); }}
        extra={
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            <QrCode className="h-3.5 w-3.5" /> Scan
          </button>
        }
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        disabled={!canPost || posting || uploading}
        onClick={submit}
        className="w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
      >
        {posting ? (goLive ? "Going live…" : "Sharing…") : goLive ? "Go live" : "Share"}
      </button>

      {scannerOpen && <ScannerModal onScan={onScan} onClose={() => setScannerOpen(false)} />}
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

function ToolButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: typeof ImagePlus; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function TagField({
  icon: Icon, placeholder, query, setQuery, tagged, onClear, results, onSelect, extra,
}: {
  icon: typeof Store;
  placeholder: string;
  query: string;
  setQuery: (v: string) => void;
  tagged?: string;
  onClear: () => void;
  results: { id: string; label: string }[];
  onSelect: (r: { id: string; label: string }) => void;
  extra?: React.ReactNode;
}) {
  if (tagged) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
        <Icon className="h-4 w-4 text-indigo-500" />
        <span className="flex-1 truncate text-sm font-medium text-stone-800">{tagged}</span>
        <button type="button" onClick={onClear} aria-label="Remove tag" className="text-stone-400 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
        <Icon className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 text-base text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        {extra}
      </div>
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className="block w-full truncate px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100"
            >
              {r.label}
            </button>
          ))}
        </div>
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
