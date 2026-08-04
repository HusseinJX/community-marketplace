// Shared bits between the sourcing dashboard and the per-source fetches page.

export const ACTION = {
  published: { label: "Published", cls: "bg-emerald-100 text-emerald-700" },
  deduped: { label: "Deduped", cls: "bg-sky-100 text-sky-700" },
  held: { label: "Held for review", cls: "bg-amber-100 text-amber-700" },
} as const;

export function FetchRow({
  title, action, at, note,
}: { title: string; action: keyof typeof ACTION; at: string; note?: string }) {
  const a = ACTION[action];
  return (
    <div className="flex items-start gap-2 rounded-lg bg-stone-50 px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-stone-700">{title}</p>
        <p className="text-[10px] text-stone-400">{at}{note ? ` · ${note}` : ""}</p>
      </div>
      <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${a.cls}`}>{a.label}</span>
    </div>
  );
}
