"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Tag as TagIcon, X } from "lucide-react";
import { TagPicker, type PickedTag } from "@/components/tags/TagPicker";

export interface MemberTagView {
  tag: { id: string; slug: string; label: string; kind: string };
  recurrence: string | null;
  role: string | null;
}

const ROLES = ["vendor", "performer", "resident", "artist", "organizer"];

/**
 * Where a business is and what it's part of, on its profile.
 *
 * Read-only for everyone; editable by an admin in place. The edit affordance
 * lives here rather than in a separate admin screen because the question "is
 * this vendor at Ferry Plaza on Saturdays?" is one you answer while looking at
 * their page, not while looking at a list of tags.
 */
export function MemberTags({
  memberId,
  memberName,
  initial,
  canEdit,
}: {
  memberId: string;
  memberName: string;
  initial: MemberTagView[];
  canEdit: boolean;
}) {
  const [links, setLinks] = useState<MemberTagView[]>(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!links.length && !canEdit) return null;

  async function apply(tagId: string, patch: { role?: string | null; recurrence?: string | null }) {
    setBusy(tagId);
    try {
      const current = links.find((l) => l.tag.id === tagId);
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId,
          memberId,
          memberName,
          // The write is an upsert on (member, tag), so sending the whole edge
          // each time is also how an edit works — no separate PATCH.
          role: patch.role !== undefined ? patch.role : (current?.role ?? null),
          recurrence: patch.recurrence !== undefined ? patch.recurrence : (current?.recurrence ?? null),
        }),
      });
      if (!res.ok) return;
      setLinks((ls) =>
        ls.map((l) => (l.tag.id === tagId ? { ...l, ...patch } as MemberTagView : l)),
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(tagId: string) {
    setBusy(tagId);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId, memberId, remove: true }),
      });
      if (res.ok) setLinks((ls) => ls.filter((l) => l.tag.id !== tagId));
    } finally {
      setBusy(null);
    }
  }

  async function add(picked: PickedTag[]) {
    const fresh = picked.filter((p) => !links.some((l) => l.tag.id === p.id));
    for (const p of fresh) {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: p.id, memberId, memberName }),
      });
      if (res.ok) {
        setLinks((ls) => [
          ...ls,
          { tag: { id: p.id, slug: "", label: p.label, kind: p.kind }, role: null, recurrence: null },
        ]);
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {links.map(({ tag, role, recurrence }) =>
          editing ? (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-1 pl-3 pr-1 text-xs font-semibold text-emerald-800"
            >
              <TagIcon className="h-3 w-3" />
              {tag.label}
              <button
                onClick={() => void remove(tag.id)}
                disabled={busy === tag.id}
                aria-label={`Remove ${tag.label}`}
                className="rounded-full p-0.5 hover:bg-emerald-100 disabled:opacity-50"
              >
                {busy === tag.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </span>
          ) : (
            <Link
              key={tag.id}
              // A tag added just now has no slug in hand yet; the id route
              // isn't a thing, so send those to the profile refresh instead of
              // a dead link.
              href={tag.slug ? `/tags/${tag.slug}` : `/members/${memberId}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <TagIcon className="h-3 w-3" />
              {tag.label}
              {(role || recurrence) && (
                <span className="font-normal text-emerald-700">
                  · {[role, recurrence].filter(Boolean).join(" · ")}
                </span>
              )}
            </Link>
          ),
        )}

        {canEdit && (
          <button
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
          >
            {editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            {editing ? "Done" : links.length ? "Edit tags" : "Add a tag"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
          {/* Per-tag detail. This is where the edge's own facts live: a market
              is permanent, but THIS vendor is only there on Saturdays. */}
          {links.map(({ tag, role, recurrence }) => (
            <div key={tag.id} className="space-y-2 border-b border-stone-100 pb-3 last:border-0 last:pb-0">
              <p className="text-xs font-semibold text-stone-700">{tag.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => void apply(tag.id, { role: role === r ? null : r })}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition ${
                      role === r ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                defaultValue={recurrence ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (recurrence ?? "")) void apply(tag.id, { recurrence: v || null });
                }}
                placeholder="When are they there? Saturdays, first Sunday…"
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none"
              />
            </div>
          ))}

          <TagPicker
            value={[]}
            onChange={(picked) => void add(picked)}
            coords={null}
          />
        </div>
      )}
    </div>
  );
}
