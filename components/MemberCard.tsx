import Link from "next/link";
import type { Member } from "@/lib/types";
import { milesLabel } from "@/lib/proximity";
import { ImageCarousel } from "./ImageCarousel";
import { HeroMedia } from "./HeroMedia";
import { memberImages } from "@/lib/member-images";
import { hoursStatus } from "@/lib/business-hours";
import { DirectionsButton } from "@/components/map/DirectionsButton";
import { SaveBusinessButton } from "@/components/SaveBusinessButton";

const TYPE_GRADIENTS: Record<string, string> = {
  vendor: "from-blue-300 to-indigo-400",
  artist: "from-violet-300 to-purple-400",
  organizer: "from-emerald-300 to-teal-400",
  shopper: "from-orange-200 to-amber-300",
  influencer: "from-pink-300 to-rose-400",
};

/**
 * A business, as a listing card.
 *
 * ── Why the text is BELOW the photo ──────────────────────────────────────────
 * It used to sit ON the photo, as white type over a frosted scrim across the
 * bottom third. That looked good on a well-lit hero shot and fell apart
 * everywhere else: legibility was a coin flip per image, the scrim ate the part
 * of the picture the business had chosen, and — the reason it had to go — text
 * inside an image never aligns across a row. Four cards side by side had their
 * names at four different heights, because each name sat wherever its own photo
 * ended.
 *
 * Below the image, every card in a row shares a baseline grid, and the photo is
 * whole. That is the Airbnb arrangement and the reason their index reads as
 * calm at any density.
 *
 * ── The last line ────────────────────────────────────────────────────────────
 * Every card ends with ONE bold fact, the way Airbnb's ends with a price. Here
 * that is whether they're open right now — the single most useful thing to know
 * about a local business and, until now, something we made people open the
 * profile to find. It falls back through distance to nothing at all; see
 * `terminal` below.
 */
export function MemberCard({
  member,
  matchedOn,
  miles,
  // True when the reader's position is known. Lets the card distinguish "we
  // can't measure this" from "we don't know where you are" — without it, a
  // silent gap where a distance should be reads as "nearby".
  hasPosition = false,
  compact = false,
  linked = false,
  onHover,
}: {
  member: Member;
  matchedOn?: string[];
  miles?: number | null;
  hasPosition?: boolean;
  /**
   * A small card inside a horizontal rail (~176–208px), rather than a full
   * grid tile. Three consequences, all about weight:
   *
   *  - ONE image, not the carousel. Most businesses carry three, and 44 rail
   *    cards on the event page rendered 106 `<img>` between them — each with a
   *    six-entry srcSet of ~150-character URLs. That markup alone was ~400KB,
   *    far more than the member data it was drawn from. Swiping a 176px card
   *    inside a horizontally-scrolling rail fights the rail's own gesture
   *    anyway, so the carousel was never really usable at this size.
   *  - A `sizes` that matches the real card width. The default declares
   *    `100vw`, so on a phone the browser fetches a full-viewport-width file
   *    for a card a fifth that wide — the same oversized-decode that OOM'd the
   *    iOS webview once already (see ImageCarousel MEMORY LEVER notes).
   *  - No Directions chip. At 176px the text block has no room for a control,
   *    and the profile one tap away carries it.
   */
  compact?: boolean;
  /**
   * This card's marker is currently hovered on the map beside it. Draws the
   * paired outline (`.is-linked`, globals.css). The state is owned by whatever
   * renders BOTH the list and the map, never by the card — see the split view
   * in components/home/SplitResults.
   */
  linked?: boolean;
  /** Hovering the card highlights its marker. Same pairing, other direction. */
  onHover?: (id: string | null) => void;
}) {
  const p = member.profile ?? {};
  const name = p.name || "Anonymous member";
  const location = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const type = (p.memberType as string | undefined)?.toLowerCase() ?? "";
  const gradient = TYPE_GRADIENTS[type] ?? "from-stone-200 to-stone-300";
  // Curated hero → profile.images[] → profile.imageUrl → coloured gradient.
  // The order lives in lib/member-images.ts because the Shops directory reads
  // the same list to decide whether this member gets a tile at all.
  const allImages = memberImages(member);
  const carouselImages = compact ? allImages.slice(0, 1) : allImages;

  const subtitle = [p.neighborhood || p.city, p.category as string | undefined]
    .filter(Boolean)
    .join(" · ");
  const hasCoords = typeof p.latitude === "number" && typeof p.longitude === "number";
  const address = (p.businessAddress as string | undefined) || location || null;

  // The bold closing line: whether they're open, and nothing else.
  //
  // Null when the hours string doesn't parse unambiguously (lib/business-hours
  // returns null on any doubt, because a wrong "Open until 8pm" sends someone
  // across the city to a locked door). Null renders NOTHING — never a
  // placeholder. "Hours unknown" on every card of every business that wrote its
  // hours in prose is noise pretending to be information, and a card with three
  // lines instead of four is a perfectly good card.
  //
  // Distance is deliberately not a fallback here: it already has the top line,
  // next to the name.
  const hours = hoursStatus(p.businessHours as string | undefined);

  return (
    <Link
      href={`/members/${member.id}`}
      className={`listing group ${linked ? "is-linked" : ""}`}
      onMouseEnter={onHover ? () => onHover(member.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      <div className="card-media aspect-square">
        {carouselImages.length > 0 ? (
          <ImageCarousel
            images={carouselImages}
            alt={name}
            aspect="square"
            // The rounding belongs to `.card-media`, which is what lifts on
            // hover — rounding the carousel too would leave a hairline of the
            // wrapper showing at the corners.
            rounded="rounded-none"
            showCounter={false}
            indicators={carouselImages.length > 1}
            // Matches `w-44 sm:w-52` on the rail wrappers. Stated so next/image
            // stops offering (and phones stop fetching) full-width candidates.
            sizes={compact ? "(min-width:640px) 208px, 176px" : undefined}
            fallbackGradient={gradient}
          />
        ) : (
          // Nothing usable — HeroMedia with no images IS the gradient.
          <HeroMedia images={[]} gradientClass={gradient} alt={name} aspect="square" />
        )}

        {/* Top-RIGHT, which is where a save lives on every listing surface
            people already use. It sat top-left, where it collided with the
            badge slot every card design eventually wants. */}
        <SaveBusinessButton memberId={member.id} variant="overlay" />
      </div>

      {/* ── Text block ─────────────────────────────────────────────────────
          Name and distance share the top line — distance is this marketplace's
          equivalent of Airbnb's rating, and it belongs beside the name rather
          than buried below it. The name still gets the width: the distance is
          `shrink-0` and the name truncates into whatever is left. */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="t-strong min-w-0 flex-1 truncate text-stone-900">{name}</h3>
          {miles != null ? (
            <span className="t-meta shrink-0 tabular-nums text-stone-500">{milesLabel(miles)}</span>
          ) : hasPosition ? (
            // We know where the reader is but not where this business is.
            // Saying nothing here would imply it is close by.
            <span className="t-meta shrink-0 text-stone-400">no location</span>
          ) : null}
        </div>

        {subtitle && <p className="t-meta mt-0.5 truncate text-stone-500">{subtitle}</p>}

        {hours && (
          <p className={`t-strong mt-1 truncate ${hours.open ? "text-stone-900" : "text-stone-500"}`}>
            {hours.label}
          </p>
        )}

        {/* How to actually get there. Off the photo now — it used to sit in the
            scrim, which is exactly the clutter that arrangement invited.
            `pointer-events` is no longer a problem here (the text block isn't
            `pointer-events-none`), but this is still inside the card's <Link>,
            so DirectionsButton stops its own click. */}
        {!compact && (hasCoords || address) && (
          <div className="mt-2">
            <DirectionsButton
              asButton
              variant="chip"
              destination={{
                lat: p.latitude as number,
                lng: p.longitude as number,
                address,
                label: name,
              }}
            />
          </div>
        )}

        {/* Only ever rendered on the match surfaces, where WHY a card is here is
            the whole point. Everywhere else the card is image and its four
            lines, and nothing more. */}
        {matchedOn && matchedOn.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
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
      </div>
    </Link>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="listing animate-pulse">
      <div className="card-media aspect-square bg-stone-200" />
      <div className="space-y-1.5">
        <div className="h-4 w-3/4 rounded bg-stone-200" />
        <div className="h-3 w-1/2 rounded bg-stone-100" />
      </div>
    </div>
  );
}
