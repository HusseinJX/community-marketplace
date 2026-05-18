import Link from "next/link";
import type { Endorsements, Endorser } from "@/lib/endorsements";

export function EndorsementRows({ data }: { data: Endorsements }) {
  const rows: { label: string; items: Endorser[]; tone: string }[] = [];
  if (data.worksWith.length > 0)
    rows.push({
      label: "Works with",
      items: data.worksWith,
      tone: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    });
  if (data.activeIn.length > 0)
    rows.push({
      label: "Active in",
      items: data.activeIn,
      tone: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    });
  if (rows.length === 0) return null;

  return (
    <div className="mt-5 space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="section-label shrink-0">{row.label}</span>
          {row.items.map((it, i) =>
            it.id ? (
              <Link
                key={i}
                href={`/members/${it.id}`}
                className={`rounded-full px-2.5 py-0.5 text-xs transition ${row.tone}`}
              >
                {it.label}
              </Link>
            ) : (
              <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs ${row.tone}`}>
                {it.label}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
