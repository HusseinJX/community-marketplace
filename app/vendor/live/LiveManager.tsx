"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Trash2, Clock, ExternalLink, ImagePlus, X, Calendar, Play } from "lucide-react";
import { LIVE_EVENTS, eventEmoji, eventLabel, timeLeftLabel } from "@/lib/live-events";
import { partitionFixtures, getFixtures, startsInLabel, type Fixture } from "@/lib/live-fixtures";

interface BroadcastRow {
  id: string;
  event_slug: string;
  event_label: string | null;
  whats_on: string | null;
  note: string | null;
  supports_team: string | null;
  image_urls: string[];
  livestream_url: string | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

const DURATIONS = [
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "4h", minutes: 240 },
  { label: "6h", minutes: 360 },
];

export function LiveManager({
  memberId,
  memberName,
  isAdmin,
}: {
  memberId: string;
  memberName: string;
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(0);

  // Composer
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [eventSlug, setEventSlug] = useState("nba");
  const [whatsOn, setWhatsOn] = useState("");
  const [note, setNote] = useState("");
  const [supportsTeam, setSupportsTeam] = useState("");
  const [minutes, setMinutes] = useState(180);
  const [startAt, setStartAt] = useState("");
  const [livestreamUrl, setLivestreamUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pickedFixture, setPickedFixture] = useState<string | null>(null);
  const [pickedTeams, setPickedTeams] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  // Real games on right now, fetched from /api/fixtures (ESPN, no key). Seeded
  // with the curated slate so the strip renders instantly, then replaced.
  const [fixtures, setFixtures] = useState<Fixture[]>(() => getFixtures());

  const load = useCallback(async () => {
    const res = await fetch(`/api/broadcasts/${memberId}?include_expired=1`);
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    load();
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Pull the real slate once on mount (and refresh every few minutes).
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

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("memberId", memberId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        if (d.url) urls.push(d.url);
      }
    }
    setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  function resetComposer() {
    setWhatsOn("");
    setNote("");
    setSupportsTeam("");
    setLivestreamUrl("");
    setImages([]);
    setStartAt("");
    setPickedFixture(null);
    setPickedTeams([]);
    setShowManual(false);
  }

  // Tap a real game to pre-fill the composer. Live games go to "now" mode;
  // upcoming ones flip to "schedule" with the kickoff time pre-set.
  function pickFixture(f: Fixture, live: boolean) {
    setPickedFixture(f.id);
    setEventSlug(f.event_slug);
    setWhatsOn(f.matchup);
    setPickedTeams(f.teams ?? []);
    setSupportsTeam(""); // let them pick a side for this game
    setShowManual(false);
    if (live) {
      setMode("now");
    } else {
      setMode("schedule");
      // datetime-local wants a local "YYYY-MM-DDTHH:mm" string
      const d = new Date(f.starts_at);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
      setStartAt(local);
    }
  }

  function clearPick() {
    setPickedFixture(null);
    setPickedTeams([]);
    setWhatsOn("");
    setStartAt("");
    setSupportsTeam("");
  }

  const canPost = (!!pickedFixture || whatsOn.trim().length > 0) &&
    (mode === "now" || !!startAt);

  async function submit() {
    if (posting || !canPost) return;
    setPosting(true);
    try {
      await fetch(`/api/broadcasts/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName,
          event_slug: eventSlug,
          whats_on: whatsOn.trim() || null,
          note: note.trim() || null,
          supports_team: supportsTeam.trim() || null,
          livestream_url: livestreamUrl.trim() || null,
          image_urls: images,
          duration_minutes: minutes,
          starts_at: mode === "schedule" ? new Date(startAt).toISOString() : undefined,
        }),
      });
      resetComposer();
      await load();
    } finally {
      setPosting(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/broadcasts/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/broadcasts/${memberId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const isLiveRow = (r: BroadcastRow) =>
    r.active && Date.parse(r.starts_at) <= nowTs && Date.parse(r.ends_at) > nowTs;
  const isScheduledRow = (r: BroadcastRow) => r.active && Date.parse(r.starts_at) > nowTs;

  const { live: liveFixtures, upcoming: upcomingFixtures } = partitionFixtures(
    fixtures,
    nowTs || Date.now()
  );

  const liveRows = rows.filter(isLiveRow);
  const scheduledRows = rows
    .filter(isScheduledRow)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const pastRows = rows.filter((r) => !isLiveRow(r) && !isScheduledRow(r));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
            <Radio className="h-6 w-6 text-rose-500" /> Go Live
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {memberName}
            {isAdmin && (
              <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">admin</span>
            )}
          </p>
        </div>
        <Link href="/live" className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-800">
          See the Live page <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Composer */}
      <div className="card-soft space-y-4 p-4">
        {/* Pick a real game that's on right now (or coming up). This is the
            primary path — tapping one fills the matchup, sport, and time. */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-800">
            <Radio className="h-4 w-4 text-rose-500" /> What&apos;s on — pick a game
          </label>
          {liveFixtures.length === 0 && upcomingFixtures.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-3 text-xs text-stone-500">
              No games on the slate right now. You can still go live —{" "}
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="font-medium text-rose-600 underline underline-offset-2"
              >
                enter it manually
              </button>
              .
            </p>
          ) : (
            <div className="space-y-2.5">
              {liveFixtures.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-500">
                    Live now
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {liveFixtures.map((f) => (
                      <FixtureChip
                        key={f.id}
                        f={f}
                        live
                        picked={pickedFixture === f.id}
                        onPick={() => pickFixture(f, true)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {upcomingFixtures.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                    Coming up
                  </p>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {upcomingFixtures.map((f) => (
                      <FixtureChip
                        key={f.id}
                        f={f}
                        live={false}
                        picked={pickedFixture === f.id}
                        onPick={() => pickFixture(f, false)}
                        when={startsInLabel(f.starts_at, nowTs || Date.now())}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected game summary — shown once a fixture is picked. */}
        {pickedFixture && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
            <span className="text-2xl">{eventEmoji(eventSlug)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">{whatsOn}</p>
              <p className="text-xs text-stone-500">
                {eventLabel(eventSlug)} ·{" "}
                {mode === "now"
                  ? "Live now"
                  : startAt
                  ? `Starts ${new Date(startAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                  : "Scheduled"}
              </p>
            </div>
            <button
              onClick={clearPick}
              className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-white hover:text-stone-700"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Manual fallback — hidden by default; the game picker replaces it. */}
        {!pickedFixture && (
          <div>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-800"
            >
              {showManual ? "Hide manual entry" : "Not listed? Enter manually"}
            </button>
            {showManual && (
              <div className="mt-3 space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                <div className="flex rounded-full border border-stone-200 bg-white p-1 w-fit">
                  <ModeBtn active={mode === "now"} onClick={() => setMode("now")}>
                    <Radio className="h-3.5 w-3.5" /> Now
                  </ModeBtn>
                  <ModeBtn active={mode === "schedule"} onClick={() => setMode("schedule")}>
                    <Calendar className="h-3.5 w-3.5" /> Schedule
                  </ModeBtn>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Sport / event</label>
                  <select
                    value={eventSlug}
                    onChange={(e) => setEventSlug(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  >
                    {LIVE_EVENTS.map((ev) => (
                      <option key={ev.slug} value={ev.slug}>
                        {ev.emoji} {ev.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={whatsOn}
                  onChange={(e) => setWhatsOn(e.target.value)}
                  placeholder="The matchup — e.g. Lakers vs Celtics"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                {mode === "schedule" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Starts</label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rooting for? — quick chips for the picked game's two teams. */}
        {pickedTeams.length > 0 ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-500">Rooting for? (optional)</label>
            <div className="flex flex-wrap gap-2">
              {pickedTeams.map((t) => (
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
        ) : (
          <input
            value={supportsTeam}
            onChange={(e) => setSupportsTeam(e.target.value)}
            placeholder="Rooting for? (optional) — e.g. Mexico, Lakers"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional vibe — big screen, sound on, drink specials…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <input
          value={livestreamUrl}
          onChange={(e) => setLivestreamUrl(e.target.value)}
          placeholder="Livestream link (optional) — YouTube / Twitch / Instagram Live"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />

        {/* Vibe photos */}
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">Vibe photos (optional)</label>
          <div className="flex flex-wrap items-center gap-2">
            {images.map((url) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="vibe" className="h-full w-full object-cover" />
                <button
                  onClick={() => setImages((p) => p.filter((u) => u !== url))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-400 hover:border-rose-400 hover:text-rose-500">
              <ImagePlus className="h-5 w-5" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </label>
          </div>
          {uploading && <p className="mt-1 text-xs text-stone-400">Uploading…</p>}
        </div>

        {/* Timing — adjust a picked upcoming game's start (manual entry has its
            own field). */}
        {mode === "schedule" && pickedFixture && (
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Starts</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-500">
            {mode === "schedule" ? "Runs for" : "Live for"}
          </label>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setMinutes(d.minutes)}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium transition " +
                  (minutes === d.minutes
                    ? "bg-rose-600 text-white"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300")
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={posting || !canPost}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {mode === "schedule" ? <Calendar className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
          {posting ? "Saving…" : mode === "schedule" ? "Schedule it" : "Go live"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <>
          <Section title={`Live now (${liveRows.length})`} empty="You're not broadcasting anything right now.">
            {liveRows.map((r) => (
              <RowCard key={r.id} r={r} tone="live">
                <button onClick={() => patch(r.id, { ends_at: new Date(Date.parse(r.ends_at) + 3600_000).toISOString() })} className="row-btn">
                  <Clock className="h-3.5 w-3.5" /> +1h
                </button>
                <button onClick={() => patch(r.id, { active: false })} className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800">
                  End now
                </button>
              </RowCard>
            ))}
          </Section>

          {scheduledRows.length > 0 && (
            <Section title={`Scheduled (${scheduledRows.length})`}>
              {scheduledRows.map((r) => (
                <RowCard key={r.id} r={r} tone="scheduled">
                  <button onClick={() => patch(r.id, { starts_at: new Date().toISOString() })} className="row-btn">
                    <Play className="h-3.5 w-3.5" /> Start now
                  </button>
                  <button onClick={() => remove(r.id)} className="text-stone-400 hover:text-red-600" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </RowCard>
              ))}
            </Section>
          )}

          {pastRows.length > 0 && (
            <Section title={`Past (${pastRows.length})`}>
              {pastRows.map((r) => (
                <RowCard key={r.id} r={r} tone="past">
                  <button onClick={() => remove(r.id)} className="text-stone-400 hover:text-red-600" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </RowCard>
              ))}
            </Section>
          )}
        </>
      )}

      <style>{`.row-btn{display:inline-flex;align-items:center;gap:.25rem;border:1px solid #e7e5e4;background:#fff;border-radius:.5rem;padding:.375rem .75rem;font-size:.75rem;font-weight:500;color:#44403c}.row-btn:hover{border-color:#d6d3d1}`}</style>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <section>
      <p className="section-label mb-3">{title}</p>
      {isEmpty ? <p className="text-sm text-stone-400">{empty}</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

function RowCard({
  r,
  tone,
  children,
}: {
  r: BroadcastRow;
  tone: "live" | "scheduled" | "past";
  children: React.ReactNode;
}) {
  const border =
    tone === "live" ? "border-rose-200 bg-rose-50/60" : tone === "scheduled" ? "border-sky-200 bg-sky-50/50" : "border-stone-200 bg-white opacity-70";
  const sub =
    tone === "scheduled"
      ? new Date(r.starts_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : tone === "live"
      ? timeLeftLabel(r.ends_at)
      : "ended";
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${border}`}>
      {r.image_urls?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image_urls[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <span className="text-2xl">{eventEmoji(r.event_slug)}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900">
          {r.whats_on || eventLabel(r.event_slug, r.event_label)}
        </p>
        <p className="truncate text-xs text-stone-500">
          {eventLabel(r.event_slug, r.event_label)}
          {r.supports_team ? ` · 🏳️ ${r.supports_team}` : ""}
          {r.livestream_url ? " · 📺 stream" : ""} ·{" "}
          <span className={tone === "live" ? "font-medium text-rose-600" : "font-medium text-stone-600"}>{sub}</span>
        </p>
      </div>
      {children}
    </div>
  );
}

function FixtureChip({
  f,
  live,
  picked,
  onPick,
  when,
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
        (picked
          ? "border-rose-500 bg-rose-50 ring-1 ring-rose-400"
          : "border-stone-200 bg-white hover:border-rose-300")
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

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
        (active ? "bg-rose-600 text-white" : "text-stone-600 hover:text-stone-900")
      }
    >
      {children}
    </button>
  );
}
