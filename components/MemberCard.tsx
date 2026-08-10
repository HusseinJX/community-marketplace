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

  const subtitle = [location, p.category as string | undefined].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/members/${member.id}`}
      className="group card-soft card-hover relative flex h-full flex-col overflow-hidden"
    >
      <div className="relative">
        {carouselImages && carouselImages.length > 0 ? (
          <ImageCarousel
            images={carouselImages}
            alt={name}
            aspect="tall"
            rounded="rounded-none"
            showCounter={carouselImages.length > 1}
            // The name plate owns the bottom edge — dots would sit underneath it.
            indicators={false}
            fallbackGradient={gradient}
          />
        ) : (
          <HeroMedia
            images={p.imageUrl ? [p.imageUrl] : []}
            gradientClass={gradient}
            alt={name}
            aspect="tall"
          />
        )}

        {/* Type sits on the image, top-left, clear of the carousel's counter. */}
        <div className="pointer-events-none absolute left-2.5 top-2.5">
          <MemberTypeBadge type={p.memberType} />
        </div>

        {/* Frosted plate rather than a block of card below the photo. Everything
            the card has to say fits in two lines over the image, so the picture
            is the card — the old layout gave more height to text than to the
            photo, which reads as clunky in a feed of images. A scrim under the
            blur keeps white type legible over a bright photo. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="bg-gradient-to-t from-black/55 via-black/25 to-transparent px-3 pb-3 pt-8 backdrop-blur-[2px]">
            {/* The name gets the full width of the card. It shared a row with
                the distance chip, and on a rail card that turned "Hamburger
                Haven" into "Hamburge Haven" — the chip is a detail, the name
                is the thing you are reading. */}
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-tight text-white drop-shadow-sm">
              {name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              {miles != null ? (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-white/25 px-2 py-0.5 font-mono text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                  <MapPin className="mr-0.5 inline h-3 w-3" />
                  {milesLabel(miles)}
                </span>
              ) : hasPosition ? (
                // We know where the reader is but not where this business is.
                // Saying nothing here would imply it is close by.
                <span className="shrink-0 whitespace-nowrap rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white/70 backdrop-blur-md">
                  no location
                </span>
              ) : null}
              {subtitle && (
                <p className="min-w-0 truncate text-[11px] text-white/80">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Only ever rendered on the match surfaces, where WHY a card is here is
          the whole point. Everywhere else the card is image and nothing else. */}
      {matchedOn && matchedOn.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
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
    </Link>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="card-soft flex animate-pulse flex-col overflow-hidden">
      <div className="aspect-[4/5] w-full bg-stone-200" />
    </div>
  );
}
