import Link from "next/link";
import type { Member } from "@/lib/types";
import { MemberTypeBadge } from "./MemberTypeBadge";
import { ImageCarousel } from "./ImageCarousel";
import { HeroMedia } from "./HeroMedia";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";

const TYPE_GRADIENTS: Record<string, string> = {
  vendor: "from-blue-300 to-indigo-400",
  artist: "from-violet-300 to-purple-400",
  organizer: "from-emerald-300 to-teal-400",
  shopper: "from-orange-200 to-amber-300",
  influencer: "from-pink-300 to-rose-400",
};

function collectTags(p: Member["profile"]): string[] {
  if (!p) return [];
  const candidates = [
    ...((p.services ?? []) as string[]),
    ...((p.specialties ?? []) as string[]),
    ...((p.menuHighlights ?? []) as string[]),
    ...((p.shareTypes ?? []) as string[]),
    ...((p.interests ?? []) as string[]),
  ];
  return Array.from(new Set(candidates)).slice(0, 2);
}

export function MemberCard({ member, matchedOn }: { member: Member; matchedOn?: string[] }) {
  const p = member.profile ?? {};
  const name = p.name || "Anonymous member";
  const location = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const tags = collectTags(p);
  const notesStr = Array.isArray(p.notes) ? (p.notes as string[]).join(" · ") : (p.notes as string | undefined);
  const blurb = (p.approvedBlurb || p.personalNote || p.businessDescription || notesStr || p.description || "") as string;
  const type = (p.memberType as string | undefined)?.toLowerCase() ?? "";
  const gradient = TYPE_GRADIENTS[type] ?? "from-stone-200 to-stone-300";
  const heroImages = MEMBER_HERO_IMAGES[member.id];
  // Fallback for imported members: the single imageUrl saved by the
  // prolocaliq import / google-places harvest. Some sources (legacybusiness.org)
  // can be flaky, so HeroMedia swaps to the gradient on load error.
  const fallbackImage = (p as { imageUrl?: string; image_url?: string }).imageUrl
    || (p as { imageUrl?: string; image_url?: string }).image_url;
  const cardImages = heroImages && heroImages.length > 0
    ? heroImages
    : (fallbackImage ? [fallbackImage] : []);

  return (
    <Link
      href={`/members/${member.id}`}
      className="group card-soft card-hover flex flex-col overflow-hidden"
    >
      {heroImages && heroImages.length > 0 ? (
        <ImageCarousel
          images={heroImages}
          alt={name}
          aspect="video"
          rounded="rounded-none"
          showCounter={false}
        />
      ) : (
        <HeroMedia images={cardImages} gradientClass={gradient} alt={name} />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight text-stone-900 transition group-hover:text-indigo-700">
            {name}
          </h3>
          <MemberTypeBadge type={p.memberType} />
        </div>

        {location && (
          <div className="text-sm text-stone-500">{location}</div>
        )}

        {(p.category || p.subcategory) && (
          <div className="text-xs text-stone-500">
            {p.category as string}
            {p.category && p.subcategory && <span className="mx-1">·</span>}
            {p.subcategory as string}
          </div>
        )}

        {blurb && (
          <p className="line-clamp-3 text-sm text-stone-700">{blurb}</p>
        )}

        {matchedOn && matchedOn.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {matchedOn.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                title="matched this filter"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="card-soft flex animate-pulse flex-col overflow-hidden">
      <div className="aspect-[16/10] w-full bg-stone-200" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 rounded bg-stone-200" />
        <div className="h-3 w-1/2 rounded bg-stone-200" />
        <div className="h-3 w-1/3 rounded bg-stone-200" />
        <div className="h-12 w-full rounded bg-stone-100" />
      </div>
    </div>
  );
}
