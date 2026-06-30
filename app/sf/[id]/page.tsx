import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { SF_STORIES, getSfStory } from "@/lib/sf-stories";

export function generateStaticParams() {
  return SF_STORIES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getSfStory(id);
  if (!story) return { title: "San Francisco" };
  return { title: story.title, description: story.dek };
}

export default async function SfStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = getSfStory(id);
  if (!story) notFound();

  const more = SF_STORIES.filter((s) => s.id !== story.id).slice(0, 3);

  return (
    <article className="mx-auto max-w-2xl px-4 pb-24 md:px-6">
      <Link
        href="/sf"
        className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        <ChevronLeft className="h-4 w-4" /> San Francisco
      </Link>

      <p className="mt-6 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-teal-600">
        <MapPin className="h-3.5 w-3.5" /> {story.neighborhood}
        {story.since ? ` · ${story.since}` : ""}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-stone-900 md:text-4xl">
        {story.title}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">{story.dek}</p>

      <div className="mt-6 overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={story.imageUrl} alt={story.title} className="h-60 w-full object-cover md:h-80" />
      </div>

      <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-stone-800">
        {story.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {/* More to read */}
      <div className="mt-12 border-t border-stone-200 pt-8">
        <p className="section-label mb-4">More about SF</p>
        <div className="space-y-3">
          {more.map((s) => (
            <Link
              key={s.id}
              href={`/sf/${s.id}`}
              className="card-soft card-hover flex items-center gap-4 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-stone-900">{s.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-stone-500">{s.dek}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
