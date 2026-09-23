import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Tag as TagIcon } from "lucide-react";
import { BackToHome } from "@/components/BackToHome";
import { getTagBySlug, getMembersForTag, tagIsCurrent } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug).catch(() => null);
  if (!tag) return { title: "Tag" };
  return {
    title: `${tag.label} — who's there`,
    description: tag.description ?? `Local businesses at ${tag.label}.`,
    alternates: { canonical: `/tags/${tag.slug}` },
  };
}

function dateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

// Everyone in one tag. The page that makes tags worth being public: "who trades
// at Ferry Plaza", "who played Outside Lands 2026", "every location of this".
export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug).catch(() => null);
  if (!tag) notFound();

  const members = await getMembersForTag(tag.id).catch(() => []);
  const when = dateRange(tag.starts_at, tag.ends_at);
  // Only a bounded THING can be over — a festival that has finished. A market
  // is never "past", however long since anyone was tagged into it.
  const over = !tagIsCurrent(tag);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <BackToHome href="/browse" label="Browse" />

      <div className="mt-4">
        <p className="t-meta inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.16em] text-coral-700">
          <TagIcon className="h-3.5 w-3.5" />
          {tag.kind}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{tag.label}</h1>
        {tag.description && <p className="mt-2 text-sm text-stone-600">{tag.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-500">
          {when && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {when}
              {over && <span className="font-semibold text-stone-400">· finished</span>}
            </span>
          )}
          {tag.lat != null && tag.lng != null && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {tag.lat.toFixed(4)}, {tag.lng.toFixed(4)}
            </span>
          )}
          <span>
            {members.length} {members.length === 1 ? "business" : "businesses"}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {members.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
            Nobody is tagged here yet.
          </p>
        ) : (
          members.map((m) => (
            <Link
              key={m.id}
              href={`/members/${m.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-stone-950">
                  {m.name || "Local business"}
                </span>
                {(m.role || m.recurrence) && (
                  <span className="mt-0.5 block truncate text-sm text-stone-500">
                    {[m.role, m.recurrence].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
