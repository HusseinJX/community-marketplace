"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, X } from "lucide-react";
import { LIVE_EVENTS, eventEmoji, eventLabel } from "@/lib/live-events";

interface FList {
  id: string;
  title: string;
  subtitle: string | null;
  event_slug: string | null;
  supports_team: string | null;
  member_ids: string[];
  sort_order: number;
  active: boolean;
}

const BLANK = { title: "", subtitle: "", event_slug: "nba", supports_team: "" };

export function FeaturedManager() {
  const [lists, setLists] = useState<FList[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/featured?admin=1");
    if (res.ok) setLists((await res.json()).lists ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!form.title.trim()) return;
    await fetch("/api/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        event_slug: form.event_slug || null,
        supports_team: form.supports_team.trim() || null,
        sort_order: lists.length,
      }),
    });
    setForm(BLANK);
    setShowAdd(false);
    load();
  }

  async function patch(id: string, fields: Partial<FList>) {
    await fetch("/api/featured", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/featured", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLists((l) => l.filter((x) => x.id !== id));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = lists[idx + dir];
    const cur = lists[idx];
    if (!target) return;
    patch(cur.id, { sort_order: target.sort_order });
    patch(target.id, { sort_order: cur.sort_order });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Featured lists</h1>
          <p className="mt-1 text-sm text-stone-500">
            Curated home-screen rails — &ldquo;Where to watch the NBA Finals near you&rdquo;, etc.
            They auto-fill from live broadcasts for the chosen event.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-stone-800"
        >
          <Plus className="h-4 w-4" /> New list
        </button>
      </div>

      {showAdd && (
        <div className="card-soft space-y-3 p-4">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title — e.g. Where to watch the NBA Finals near you"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <input
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            placeholder="Subtitle (optional)"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={form.event_slug}
              onChange={(e) => setForm({ ...form, event_slug: e.target.value })}
              className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              {LIVE_EVENTS.map((ev) => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.emoji} {ev.label}
                </option>
              ))}
            </select>
            <input
              value={form.supports_team}
              onChange={(e) => setForm({ ...form, supports_team: e.target.value })}
              placeholder="Team filter (optional) — e.g. Mexico"
              className="w-1/2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={create}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-indigo-700"
          >
            Create list
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="text-sm text-stone-400">No featured lists yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {lists.map((l, idx) => (
            <ListRow
              key={l.id}
              l={l}
              first={idx === 0}
              last={idx === lists.length - 1}
              onUp={() => move(idx, -1)}
              onDown={() => move(idx, 1)}
              onToggle={() => patch(l.id, { active: !l.active })}
              onDelete={() => remove(l.id)}
              onPatch={(f) => patch(l.id, f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListRow({
  l,
  first,
  last,
  onUp,
  onDown,
  onToggle,
  onDelete,
  onPatch,
}: {
  l: FList;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onPatch: (f: Partial<FList>) => void;
}) {
  const [memberId, setMemberId] = useState("");

  return (
    <div
      className={
        "rounded-xl border p-4 " +
        (l.active ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-50 opacity-70")
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{eventEmoji(l.event_slug)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-900">{l.title}</p>
          {l.subtitle && <p className="text-xs text-stone-500">{l.subtitle}</p>}
          <p className="mt-1 text-xs text-stone-400">
            {eventLabel(l.event_slug)}
            {l.supports_team ? ` · supports ${l.supports_team}` : ""}
            {l.member_ids.length ? ` · ${l.member_ids.length} pinned` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onUp} disabled={first} className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button onClick={onDown} disabled={last} className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button onClick={onToggle} className="rounded p-1 text-stone-500 hover:text-stone-900" aria-label="Toggle active">
            {l.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button onClick={onDelete} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pinned venues — always shown even when not live */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {l.member_ids.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
            {id}
            <button
              onClick={() => onPatch({ member_ids: l.member_ids.filter((x) => x !== id) })}
              className="text-stone-400 hover:text-red-600"
              aria-label="Remove pinned venue"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="Pin venue by member ID"
            className="w-44 rounded-lg border border-stone-200 px-2 py-1 text-xs"
          />
          <button
            onClick={() => {
              const id = memberId.trim();
              if (id && !l.member_ids.includes(id)) onPatch({ member_ids: [...l.member_ids, id] });
              setMemberId("");
            }}
            className="rounded-lg bg-stone-900 px-2 py-1 text-xs text-white hover:bg-stone-800"
          >
            Pin
          </button>
        </div>
      </div>
    </div>
  );
}
