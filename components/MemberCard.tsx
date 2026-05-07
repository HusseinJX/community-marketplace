import Link from "next/link";
import type { Member } from "@/lib/types";
import { MemberTypeBadge } from "./MemberTypeBadge";

export function MemberCard({ member }: { member: Member }) {
  const p = member.profile ?? {};
  const name = p.name || "Anonymous member";
  const location = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const interests = (p.interests ?? []).slice(0, 3);
  const notesStr = Array.isArray(p.notes) ? (p.notes as string[]).join(" · ") : (p.notes as string | undefined);
  const blurb = (p.approvedBlurb || p.personalNote || p.businessDescription || notesStr || p.description || "") as string;

  return (
    <Link
      href={`/members/${member.id}`}
      className="group block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-stone-900 group-hover:text-indigo-700">
          {name}
        </h3>
        <MemberTypeBadge type={p.memberType} />
      </div>

      {location && (
        <p className="mt-1 text-sm text-stone-500">{location}</p>
      )}

      {(p.category || p.subcategory) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {p.category && <span className="text-xs text-stone-500">{p.category as string}</span>}
          {p.category && p.subcategory && <span className="text-xs text-stone-400">·</span>}
          {p.subcategory && <span className="text-xs text-stone-500">{p.subcategory as string}</span>}
        </div>
      )}

      {blurb && (
        <p className="mt-3 line-clamp-3 text-sm text-stone-700">{blurb}</p>
      )}

      {interests.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {interests.map(i => (
            <span
              key={i}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
            >
              {i}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
