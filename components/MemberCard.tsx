import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Member } from "@/lib/types";
import { milesLabel } from "@/lib/proximity";
import { MemberTypeBadge } from "./MemberTypeBadge";
import { ImageCarousel } from "./ImageCarousel";
import { HeroMedia } from "./HeroMedia";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";
import { usableImages } from "@/lib/image-utils";

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

export function MemberCard({
  member,
  matchedOn,
  miles,
  // True when the reader's position is known. Lets the card distinguish "we
  // can't measure this" from "we don't know where you are" — without it, a
  // silent gap where a distance should be reads as "nearby".
  hasPosition = false,
}: {
  member: Member;
  matchedOn?: string[];
  miles?: number | null;
  hasPosition?: boolean;
}) {
  const p = member.profile ?? {};
  const name = p.name || "Anonymous member";
  const location = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const tags = collectTags(p);
  const notesStr = Array.isArray(p.notes) ? (p.notes as string[]).join(" · ") : (p.notes as string | undefined);
  const blurb = (p.approvedBlurb || p.personalNote || p.businessDescription || notesStr || p.description || "") as string;
  const type = (p.memberType as string | undefined)?.toLowerCase() ?? "";
  const gradient = TYPE_GRADIENTS[type] ?? "from-stone-200 to-stone-300";
  // Image priority:
  //   1) hand-curated MEMBER_HERO_IMAGES (for showcased demo members)
  //   2) imported profile.images[] (e.g. prolocaliq DigitalOcean Spaces — 3/biz)
  //   3) single profile.imageUrl fallback
  //   4) coloured gradient
  const curated = MEMBER_HERO_IMAGES[member.id];
  const profileImages = Array.isArray(p.images) ? usableImages(p.images) : [];
  const carouselImages = curated && curated.length ? curated : (profileImages.length ? profileImages : null);

  return (
    <Link
      href={`/members/${member.id}`}
      className="group card-soft card-hover flex h-full flex-col overflow-hidden"
    >
      {carouselImages && carouselImages.length > 0 ? (
        <ImageCarousel
          images={carouselImages}
          alt={name}
          aspect="video"
          rounded="rounded-none"
          showCounter={carouselImages.length > 1}
          fallbackGradient={gradient}
        />
      ) : (
        <HeroMedia
          images={p.imageUrl ? [p.imageUrl] : []}
          gradientClass={gradient}
          alt={name}
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight text-stone-900 transition group-hover:text-indigo-700">
            {name}
          </h3>
          <MemberTypeBadge type={p.memberType} />
        </div>

        {(location || hasPosition) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
            {location && <span>{location}</span>}
            {miles != null ? (
              <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                <MapPin className="mr-0.5 inline h-3 w-3" />
                {milesLabel(miles)}
              </span>
            ) : hasPosition ? (
              // We know where the reader is but not where this business is.
              // Saying nothing here would imply it is close by.
              <span className="whitespace-nowrap rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-400">
                no location
              </span>
            ) : null}
          </div>
        )}

        {(p.category || p.subcategory) && (
          <div className="text-xs text-stone-500">
            {p.category as string}
            {p.category && p.subcategory && <span className="mx-1">·</span>}
            {p.subcategory as string}
          </div>
        )}

        {blurb && (
          <p className="line-clamp-2 text-sm text-stone-700">{blurb}</p>
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
      <div className="space-y-3 p-4">
        <div className="h-5 w-2/3 rounded bg-stone-200" />
        <div className="h-3 w-1/2 rounded bg-stone-200" />
        <div className="h-3 w-1/3 rounded bg-stone-200" />
        <div className="h-12 w-full rounded bg-stone-100" />
      </div>
    </div>
  );
}
