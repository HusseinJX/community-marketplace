"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SOURCES, SOURCE_META, PLACES, COUNTRIES, fetchesForSource,
  RESIDENT_RESOURCES, BUSINESS_RESOURCES,
  type Source, type Place, type DirItem,
} from "@/lib/prototype-data";
import { FetchRow } from "./_shared";

const STATUS = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  paused: { label: "Paused", cls: "bg-stone-100 text-stone-500", dot: "bg-stone-400" },
  error: { label: "Error", cls: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
} as const;

const EMOJI_CHOICES = ["🏙️", "🌴", "🌲", "🏖️", "🏜️", "⛰️", "🌉", "🗽", "🌆", "🎸"];

// Exported as a named component so the real Super-admin can embed it as a
// "Sourcing" tab (app/vendor/admin/AdminPanel.tsx); the default export below
// keeps this prototype route working on its own.
// `onDetailChange` lets a host (the Super-admin panel) hide its top tab pills
// while you're drilled into a city — master-detail, one job on screen.
export function SourcingAdmin({ onDetailChange }: { onDetailChange?: (open: boolean) => void } = {}) {
  const [added, setAdded] = useState<Place[]>([]);
  const [countryId, setCountryId] = useState("us");
  const [placeId, setPlaceId] = useState<string | null>(null); // null = cities grid
  const [running, setRunning] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const places = [...PLACES, ...added];
  const place = places.find((p) => p.id === placeId) ?? null;

  useEffect(() => {
    onDetailChange?.(!!place);
  }, [place, onDetailChange]);

  const addCity = (city: string, emoji: string) => {
    const id = "new-" + city.toLowerCase().replace(/\s+/g, "-").slice(0, 12);
    const p: Place = { id, countryId, city, emoji, status: "planned" };
    setAdded((a) => [...a, p]);
    setShowAdd(false);
    setPlaceId(id); // drop straight into its (empty) setup view
  };

  return (
    <div>
      {place ? (
        <CityDetail place={place} running={running} setRunning={setRunning} onBack={() => setPlaceId(null)} />
      ) : (
        <AllCities
          places={places}
          countryId={countryId}
          setCountryId={setCountryId}
          onOpen={setPlaceId}
          onAdd={() => setShowAdd(true)}
        />
      )}

      {showAdd && <AddCityModal onClose={() => setShowAdd(false)} onAdd={addCity} />}
    </div>
  );
}

// ── Country → cities overview ────────────────────────────────────────────────
function AllCities({
  places, countryId, setCountryId, onOpen, onAdd,
}: {
  places: Place[]; countryId: string; setCountryId: (id: string) => void;
  onOpen: (id: string) => void; onAdd: () => void;
}) {
  const country = COUNTRIES.find((c) => c.id === countryId)!;
  const cities = places.filter((p) => p.countryId === countryId);
  const liveCount = cities.filter((p) => p.status === "live").length;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Markets</h1>
        <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-stone-500">Admin</span>
      </div>
      <p className="mb-3 text-sm text-stone-500">Country → city → sources. Only the US is live for now.</p>

      {/* Country selector */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {COUNTRIES.map((c) => {
          const on = c.id === countryId;
          return (
            <button
              key={c.id}
              onClick={() => setCountryId(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                on ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
              }`}
            >
              <span>{c.flag}</span>
              {c.name}
              <span
                className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
                  c.status === "live" ? "bg-emerald-400" : on ? "bg-white/50" : "bg-stone-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Cities within the selected country */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-stone-700">
          <span>{country.flag}</span> {country.name} · cities
        </h2>
        <span className="text-xs text-stone-400">{liveCount} live · {cities.length - liveCount} planned</span>
      </div>

      <button
        onClick={onAdd}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white py-3 text-sm font-bold text-stone-700"
      >
        <span className="text-lg">＋</span> Add a city to {country.name}
      </button>

      {cities.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white px-6 py-8 text-center text-sm text-stone-500">
          No cities in {country.name} yet. Add one to start this market.
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-2.5">
        {cities.map((p) => {
          const srcs = SOURCES.filter((s) => s.placeId === p.id);
          const published = srcs.reduce((a, s) => a + s.published, 0);
          const live = p.status === "live";
          return (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="rounded-2xl bg-white p-3 text-left ring-1 ring-stone-200"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl">{p.emoji}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    live ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {live ? "● Live" : "Planned"}
                </span>
              </div>
              <p className="mt-2 font-bold leading-tight">{p.city}</p>
              {live ? (
                <p className="mt-0.5 text-xs text-stone-500">{srcs.length} sources · {published} today</p>
              ) : (
                <p className="mt-0.5 text-xs text-stone-400">No sources yet · tap to set up</p>
              )}
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ── Add-city modal ───────────────────────────────────────────────────────────
function AddCityModal({ onClose, onAdd }: { onClose: () => void; onAdd: (city: string, emoji: string) => void }) {
  const [city, setCity] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a city</h2>
          <button onClick={onClose} className="text-stone-400">✕</button>
        </div>

        <label className="mb-1 block text-xs font-semibold text-stone-500">City name</label>
        <input
          autoFocus value={city} onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Seattle"
          className="mb-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-xs font-semibold text-stone-500">Icon</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${
                emoji === e ? "bg-stone-900" : "bg-stone-100"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-stone-100 p-3 text-xs text-stone-500">
          Adds the city as <b>planned</b>. It goes live once you add its first source
          (calendars, venues, local accounts).
        </div>

        <button
          onClick={() => city.trim() && onAdd(city.trim(), emoji)}
          disabled={!city.trim()}
          className="mt-3 w-full rounded-full bg-stone-900 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Add {city.trim() || "city"}
        </button>
      </div>
    </div>
  );
}

// ── Per-city detail (the dashboard) ──────────────────────────────────────────
function CityDetail({
  place, running, setRunning, onBack,
}: { place: Place; running: string | null; setRunning: (s: string | null) => void; onBack: () => void }) {
  const sources = SOURCES.filter((s) => s.placeId === place.id);
  const totals = sources.reduce(
    (a, s) => ({ pulled: a.pulled + s.pulled, published: a.published + s.published }),
    { pulled: 0, published: 0 }
  );
  const activeCount = sources.filter((s) => s.status === "active").length;
  const heldCount = sources.reduce(
    (n, s) => n + fetchesForSource(s.id).filter((f) => f.action === "held").length,
    0
  );
  const run = (id: string) => { setRunning(id); setTimeout(() => setRunning(null), 1400); };

  return (
    <div>
      <button onClick={onBack} className="mb-1 text-xs font-semibold text-stone-500">‹ All cities</button>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <span>{place.emoji}</span> {place.city}
      </h1>

      {place.status === "planned" ? (
        <NotLaunched city={place.city} emoji={place.emoji} />
      ) : (
        <>
          <div className="mb-4 mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
            <p className="text-sm font-bold text-emerald-800">{sources.length} sources feeding the {place.city} feed</p>
            <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white">Live</span>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2">
            <Stat n={totals.published} label="Published today" />
            <Stat n={totals.pulled} label="Pulled" />
            <Stat n={activeCount} label="Active sources" />
            <Stat n={heldCount} label="Awaiting review" accent="amber" />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-700">Sources</h2>
            <button className="rounded-full bg-stone-900 px-3 py-1 text-xs font-bold text-white">+ Add source</button>
          </div>
          <div className="space-y-2">
            {sources.map((s) => (
              <SourceRow key={s.id} s={s} running={running === s.id} onRun={() => run(s.id)} />
            ))}
          </div>

          {/* Resources — two audiences. Side-by-side on wide screens, stacked
              (and colour-differentiated) on phones. */}
          <div className="mt-7">
            <h2 className="text-sm font-bold text-stone-700">Resources</h2>
            <p className="mb-3 text-xs text-stone-400">What the app surfaces to residents and to local businesses.</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <ResourceGroup
                audience="For residents"
                subtitle="Food, housing, legal, health, jobs"
                accent="emerald"
                addLabel="+ Add"
                items={RESIDENT_RESOURCES.filter((d) => d.placeId === place.id)}
              />
              <ResourceGroup
                audience="For small businesses"
                subtitle="Permits, mentorship, loans, advising"
                accent="sky"
                addLabel="+ Add"
                items={BUSINESS_RESOURCES.filter((d) => d.placeId === place.id)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ACCENTS = {
  emerald: { bar: "bg-emerald-500", head: "bg-emerald-50 text-emerald-800", ring: "ring-emerald-100", tag: "bg-emerald-100 text-emerald-700" },
  sky: { bar: "bg-sky-500", head: "bg-sky-50 text-sky-800", ring: "ring-sky-100", tag: "bg-sky-100 text-sky-700" },
} as const;

function ResourceGroup({ audience, subtitle, accent, addLabel, items }: {
  audience: string; subtitle: string; accent: keyof typeof ACCENTS; addLabel: string; items: DirItem[];
}) {
  const a = ACCENTS[accent];
  return (
    <div className={`overflow-hidden rounded-2xl bg-white ring-1 ${a.ring}`}>
      {/* Coloured header = the meaningful differentiator on small screens */}
      <div className={`flex items-center justify-between px-3 py-2.5 ${a.head}`}>
        <div className="flex items-center gap-2">
          <span className={`h-4 w-1 rounded-full ${a.bar}`} />
          <div>
            <p className="text-sm font-bold leading-tight">{audience} <span className="opacity-60">· {items.length}</span></p>
            <p className="text-[11px] opacity-70">{subtitle}</p>
          </div>
        </div>
        <button className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold">{addLabel}</button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-stone-400">None yet in this city.</div>
      ) : (
        items.map((d, i) => (
          <div key={d.id} className={`flex items-center gap-2.5 px-3 py-2.5 ${i > 0 ? "border-t border-stone-100" : ""}`}>
            <span className="text-lg">{d.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.name}</p>
              {d.sub && <p className="truncate text-xs text-stone-400">{d.sub}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.tag}`}>{d.tag}</span>
          </div>
        ))
      )}
    </div>
  );
}

function NotLaunched({ city, emoji }: { city: string; emoji: string }) {
  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-stone-200 bg-white px-6 py-10 text-center">
      <div className="mb-2 text-4xl">{emoji}</div>
      <h3 className="text-lg font-bold">{city} isn&apos;t launched yet</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">
        A city goes live once it has sources feeding its feed. Add {city}&apos;s
        calendars, venues, and local accounts to turn it on.
      </p>
      <button className="mt-4 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white">
        + Add first source to launch {city}
      </button>
      <p className="mt-3 text-xs text-stone-400">
        Suggested starters: city rec-&-parks calendar, public library, Eventbrite, top local IG accounts
      </p>
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: "amber" }) {
  return (
    <div className="rounded-xl bg-white p-2.5 text-center ring-1 ring-stone-200">
      <p className={`text-xl font-extrabold ${accent === "amber" ? "text-amber-600" : "text-stone-900"}`}>{n}</p>
      <p className="mt-0.5 text-[10px] font-medium leading-tight text-stone-500">{label}</p>
    </div>
  );
}

function SourceRow({ s, running, onRun }: { s: Source; running: boolean; onRun: () => void }) {
  const meta = SOURCE_META[s.kind];
  const st = STATUS[s.status];
  const [open, setOpen] = useState(false);
  const fetches = fetchesForSource(s.id);

  return (
    <div className="rounded-2xl bg-white ring-1 ring-stone-200">
      {/* Tap the header to expand recent fetches */}
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-3 text-left">
        <span className="text-xl">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{s.handle}</p>
          <p className="text-xs text-stone-400">{meta.label}</p>
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-sky-500" : st.dot}`} />
          {running ? "Running…" : st.label}
        </span>
        <span className={`ml-0.5 text-stone-300 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>

      <div className="px-3 pb-3">
        {s.note && <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600">{s.note}</p>}

        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-[11px] text-stone-500">
            <span>last <b className="text-stone-700">{s.lastRun}</b></span>
            <span>next <b className="text-stone-700">{s.nextRun}</b></span>
            <span><b className="text-emerald-600">{s.published}</b> pub · <b className="text-stone-500">{s.filtered}</b> filtered</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={onRun}
              disabled={running}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700 disabled:opacity-50"
            >
              {running ? "…" : "Run now"}
            </button>
            <button className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
              {s.status === "paused" ? "Resume" : "Pause"}
            </button>
          </div>
        </div>

        {/* Expanded: recent fetches for THIS source */}
        {open && (
          <div className="mt-3 border-t border-stone-100 pt-2">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-400">Recent fetches</p>
            {fetches.length === 0 ? (
              <p className="py-2 text-xs text-stone-400">No fetches yet.</p>
            ) : (
              <>
                <div className="space-y-1">
                  {fetches.slice(0, 3).map((f) => (
                    <FetchRow key={f.id} title={f.title} action={f.action} at={f.at} />
                  ))}
                </div>
                <Link
                  href={`/prototype/admin/source/${s.id}`}
                  className="mt-2 inline-block text-xs font-bold text-sky-600 hover:underline"
                >
                  View all {fetches.length} fetches →
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// Route entry for the standalone /prototype/admin sandbox.
export default function PrototypeAdminPage() {
  return <SourcingAdmin />;
}
