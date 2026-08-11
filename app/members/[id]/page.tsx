import type { Metadata } from "next";
import Link from "next/link";
import { getMember, listEvents } from "@/lib/api";
import type { EventSuggestion, Member } from "@/lib/types";
import {
  SITE_NAME,
  isIndexable,
  memberDescription,
  resolveHeroImages,
} from "@/lib/seo";
import { MemberJsonLd } from "@/components/JsonLd";
import { BackToHome } from "@/components/BackToHome";
import { RememberOrigin } from "@/components/RememberOrigin";
import { getProductsByMember, getVendorEventsByMember, type SupabaseProduct, type VendorEvent } from "@/lib/vendor-connect";
import { getBroadcastsByMember, type Broadcast } from "@/lib/broadcasts";
import { isLive, eventEmoji, eventLabel as liveEventLabel, timeLeftLabel } from "@/lib/live-events";
import { MemberTypeBadge } from "@/components/MemberTypeBadge";
import { EventCard } from "@/components/EventCard";
import { MiniMap } from "@/components/MiniMap";
import { ShopSection } from "@/components/ShopSection";
import { ActionBar } from "@/components/ActionBar";
import { GroupChat } from "@/components/GroupChat";
import { ImageCarousel } from "@/components/ImageCarousel";
import { AskAssistant } from "@/components/AskAssistant";
import { getEntitlements } from "@/lib/entitlements";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";
import { usableImages, isPlaceholder } from "@/lib/image-utils";
import { ENDORSEMENTS } from "@/lib/endorsements";
import { EndorsementRows } from "@/components/EndorsementRows";
import { MemoriesGrid } from "@/components/posts/MemoriesGrid";
import { readServes, focusLabel } from "@/lib/org-focus";
import { GivesBackBadges } from "@/components/giving/GivesBackBadges";
import { BusinessFacets } from "@/components/business/BusinessFacets";
import { resolveActor } from "@/lib/admin";
import { readOwnership } from "@/lib/business-facets";
import { getDemoMember } from "@/lib/demo-members";


const TYPE_GRADIENTS: Record<string, string> = {
  vendor: "from-blue-300 to-indigo-400",
  artist: "from-violet-300 to-purple-400",
  organizer: "from-emerald-300 to-teal-400",
  shopper: "from-orange-200 to-amber-300",
  influencer: "from-pink-300 to-rose-400",
};

function Tags({ items, color = "stone" }: { items: string[]; color?: string }) {
  const cls =
    color === "indigo"
      ? "bg-indigo-50 text-indigo-700"
      : color === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-stone-100 text-stone-700";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-sm ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <div className="section-label">{title}</div>
        {right}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

// Instagram glyph (lucide dropped brand icons over trademark concerns, so we
// inline the classic mark — rounded square + lens + flash dot).
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-indigo-700 hover:underline">
      <span className="inline-flex w-4 justify-center">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

// Resolve a member from the connector API. `getMember` uses fetch,
// which Next memoizes — so calling this in both generateMetadata and the page
// for the same id hits the network at most once per request.
async function resolveMember(id: string): Promise<Member | null> {
  try {
    return (await getMember(id)).member ?? getDemoMember(id) ?? null;
  } catch {
    return getDemoMember(id) ?? null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = await resolveMember(id);

  if (!member) {
    return { title: "Member not found", robots: { index: false, follow: false } };
  }

  const p = member.profile ?? {};
  const name = (p.name as string) || "Community member";
  const city = p.city as string | undefined;
  const title = city ? `${name} · ${city}` : name;
  const description = memberDescription(member);
  const canonical = `/members/${id}`;
  const images = resolveHeroImages(id, p);
  const indexable = isIndexable(member);

  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "profile",
      images: images.length ? images : undefined,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      images: images.length ? images : undefined,
    },
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let member = null;
  let events: EventSuggestion[] = [];
  let vendorEvents: VendorEvent[] = [];
  let supabaseProducts: SupabaseProduct[] = [];
  let broadcasts: Broadcast[] = [];
  let fetchError: string | null = null;

  try {
    const [memberRes, eventsRes, prods, vEvents, bcasts] = await Promise.all([
      getMember(id),
      listEvents({ memberId: id, limit: 20 }),
      getProductsByMember(id),
      getVendorEventsByMember(id),
      // includeExpired → the venue's full live history (past + current), so
      // people can browse what they've shown, not just what's on right now.
      getBroadcastsByMember(id, true),
    ]);
    member = memberRes.member;
    events = eventsRes.events;
    supabaseProducts = prods;
    vendorEvents = vEvents;
    broadcasts = bcasts;
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load profile.";
  }

  // Demo venues/members (the sports-bar seeds shown on the live/featured
  // surfaces when the real feed is empty) live only in lib/demo-members — the
  // connector 404s on them, so resolve them here so their cards don't dead-end.
  if (!member) {
    const demo = getDemoMember(id);
    if (demo) {
      member = demo;
      fetchError = null;
    }
  }

  if (fetchError || !member) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Returns to the home tab you came from (Feed / Shop / …), not a fixed
            destination — see components/BackToHome. */}
        <BackToHome className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline" />
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {fetchError || "Member not found."}
        </div>
      </div>
    );
  }

  const p = member.profile ?? {};
  const name = (p.name || "Anonymous member") as string;
  const location = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const notesStr = Array.isArray(p.notes)
    ? (p.notes as string[]).join(" · ")
    : (p.notes as string | undefined);
  const bio = (p.approvedBlurb || p.personalNote || p.businessDescription || notesStr || "") as string;
  const memberType = (p.memberType as string | undefined)?.toLowerCase() ?? "";
  const gradient = TYPE_GRADIENTS[memberType] ?? "from-stone-200 to-stone-300";

  // The customer-service assistant is a Member+ capability and only exists for
  // business-like members. The "Inquire" button must be gated on the same
  // condition — otherwise it dispatches an event nothing is mounted to handle.
  const hasAssistant =
    ["vendor", "artist", "organizer"].includes(memberType) &&
    (await getEntitlements(id)).can.textAssistant;

  // Owner/admin can edit the business facets (size + ownership) inline.
  const facetActor = await resolveActor(id).catch(() => null);
  const canEditFacets = !!facetActor && facetActor.memberId === id;

  const interests = (p.interests ?? []) as string[];
  const goals = (p.goals ?? []) as string[];
  const services = (p.services ?? []) as string[];
  const specialties = (p.specialties ?? []) as string[];
  const menuHighlights = (p.menuHighlights ?? []) as string[];
  const products = (p.products ?? []) as string[];
  const shopUrl = (p.shopUrl || p.etsyUrl || p.shopifyUrl || "") as string;
  const venueTypes = (p.venueTypes ?? []) as string[];
  const needsMost = (p.needsMost ?? []) as string[];
  const connectWith = (p.connectWith ?? []) as string[];
  const shareTypes = (p.shareTypes ?? []) as string[];

  const hasBusiness = p.businessName || p.websiteUrl || p.businessDescription || p.businessCategory || p.businessHours || p.businessAddress || p.businessPhone;

  const knownSocialKeys = new Set([
    "instagramHandle", "tiktokHandle", "facebookUrl", "eventbriteUrl",
    "bandsintownUrl", "songkickUrl", "meetupUrl", "youtubeUrl", "youtubeHandle",
    "twitterHandle", "xHandle", "linkedinUrl", "spotifyUrl", "threadsHandle",
    "pinterestUrl", "soundcloudUrl", "etsyUrl", "shopifyUrl",
  ]);

  const extraSocials = Object.entries(p).filter(([k, v]) => {
    if (!v || typeof v !== "string") return false;
    if (knownSocialKeys.has(k)) return false;
    // Not socials: the hero image, the shop link (rendered elsewhere), and the
    // website/maps links (their own rows). Without this, imageUrl/shopUrl leak
    // into "Find them online" as a bogus link.
    if (k === "websiteUrl" || k === "googleMapsUrl" || k === "imageUrl" || k === "shopUrl") return false;
    return k.endsWith("Handle") || k.endsWith("Url");
  });

  const hasSocials = [...knownSocialKeys].some((k) => p[k]) || extraSocials.length > 0;

  // Compact social links for the profile action row (row 2) — emoji-iconed.
  const str = (v: unknown) => (v ? String(v) : "");
  const socialLinks = [
    p.instagramHandle && { href: `https://instagram.com/${str(p.instagramHandle).replace(/^@/, "")}`, label: "Instagram", icon: "📸" },
    (p.twitterHandle || p.xHandle) && { href: `https://x.com/${str(p.twitterHandle || p.xHandle).replace(/^@/, "")}`, label: "X", icon: "𝕏" },
    p.tiktokHandle && { href: `https://tiktok.com/@${str(p.tiktokHandle).replace(/^@/, "")}`, label: "TikTok", icon: "🎵" },
    (p.youtubeUrl || p.youtubeHandle) && { href: str(p.youtubeUrl) || `https://youtube.com/@${str(p.youtubeHandle).replace(/^@/, "")}`, label: "YouTube", icon: "▶️" },
    p.facebookUrl && { href: str(p.facebookUrl), label: "Facebook", icon: "👥" },
    p.linkedinUrl && { href: str(p.linkedinUrl), label: "LinkedIn", icon: "💼" },
    p.threadsHandle && { href: `https://threads.net/@${str(p.threadsHandle).replace(/^@/, "")}`, label: "Threads", icon: "🧵" },
    p.spotifyUrl && { href: str(p.spotifyUrl), label: "Spotify", icon: "🎧" },
    p.soundcloudUrl && { href: str(p.soundcloudUrl), label: "SoundCloud", icon: "☁️" },
    p.eventbriteUrl && { href: str(p.eventbriteUrl), label: "Eventbrite", icon: "🎟️" },
    p.bandsintownUrl && { href: str(p.bandsintownUrl), label: "Bandsintown", icon: "🎸" },
    p.meetupUrl && { href: str(p.meetupUrl), label: "Meetup", icon: "🤝" },
    p.pinterestUrl && { href: str(p.pinterestUrl), label: "Pinterest", icon: "📌" },
  ].filter(Boolean) as { href: string; label: string; icon: string }[];

  const hasLocation = typeof p.latitude === "number" && typeof p.longitude === "number";
  const memberTypeColor: Record<string, string> = {
    vendor: "#3B82F6", artist: "#8B5CF6", organizer: "#10B981",
    shopper: "#F97316", influencer: "#EC4899",
  };
  const pinColor = memberTypeColor[memberType] ?? "#6B7280";

  return (
    // Tight at the top on a phone: the header, the back link and the hero were
    // eating most of the first screen before you saw the business at all.
    // Desktop keeps the roomier spacing.
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-2 md:px-8 md:pt-8">
      {isIndexable(member) && <MemberJsonLd member={member} />}
      {/* This profile links onward to its own events, so record it as the place
          those events come back to. */}
      <RememberOrigin href={`/members/${id}`} label={name} />
      {/* Returns wherever you came from — the home tab you were browsing, or a
          profile that sent you here. See components/BackToHome. */}
      <BackToHome className="-ml-1 inline-flex items-center gap-1 px-1 py-1 text-[13px] text-indigo-700 hover:underline md:text-sm" />

      {/* Hero */}
      {(() => {
        const curated = MEMBER_HERO_IMAGES[id];
        const apiImages = Array.isArray(p.images) ? usableImages(p.images as string[]) : [];
        const single = typeof p.imageUrl === "string" && !isPlaceholder(p.imageUrl) ? [p.imageUrl] : [];
        const heroImages = (curated && curated.length ? curated : apiImages.length ? apiImages : single);
        return heroImages.length > 0 ? (
          <div className="mt-2 md:mt-6">
            <ImageCarousel images={heroImages} alt={name} aspect="wide" fallbackGradient={gradient} priority />
          </div>
        ) : (
          <div className={`mt-2 aspect-[21/9] w-full rounded-2xl bg-gradient-to-br md:mt-6 ${gradient}`} />
        );
      })()}

      {/* Header */}
      <header className="mt-4 border-b border-stone-200 pb-5 md:mt-8 md:pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">{name}</h1>
          <MemberTypeBadge type={p.memberType} />
        </div>
        {location && <div className="mt-2 text-stone-500">{location}</div>}
        {(p.category || p.subcategory) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.category && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-700">
                {p.category as string}
              </span>
            )}
            {p.subcategory && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-700">
                {p.subcategory as string}
              </span>
            )}
          </div>
        )}
        {p.vibe && (
          <p className="mt-4 italic text-stone-400">&ldquo;{p.vibe as string}&rdquo;</p>
        )}
        {memberType === "vendor" && ENDORSEMENTS[id] && (
          <EndorsementRows data={ENDORSEMENTS[id]} />
        )}
        <ActionBar
          memberName={name}
          memberId={id}
          isVendor={memberType === "vendor"}
          canInquire={hasAssistant}
          websiteUrl={p.websiteUrl as string | undefined}
          googleMapsUrl={p.googleMapsUrl as string | undefined}
          placeId={p.placeId as string | undefined}
          businessName={(p.businessName as string) || name}
          businessAddress={p.businessAddress as string | undefined}
          socials={socialLinks}
        />
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        {/* Main column */}
        <main className="space-y-10 lg:col-span-2">
          {memberType === "organizer" ? (
            <section>
              <div className="flex items-center justify-between">
                <div className="section-label">Community Group Chat</div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Members only
                </span>
              </div>
              <div className="mt-3">
                <GroupChat communityName={name} />
              </div>
            </section>
          ) : (
            bio && (
              <Section title="About">
                <p className="whitespace-pre-line leading-relaxed text-stone-800">{bio}</p>
              </Section>
            )
          )}

          {/* Hours, address and the map sit DIRECTLY under About.
              They used to live in the sidebar, which on desktop is fine but on
              mobile stacks after everything in the main column — so the two
              facts a visitor most often wants ("when are they open, where are
              they") landed below the memories wall and the whole shop. Moved
              for every breakpoint rather than duplicated behind `lg:hidden`,
              because a second copy would mount MiniMap twice and Leaflet would
              build a whole second map (plus tiles) to keep one of them hidden. */}
          {hasBusiness && (
            <div className="card-soft p-4">
              <div className="section-label">Business</div>
              {/* The business NAME is not repeated here — it is the page title
                  two inches above. Nor is "Visit website": the action row at the
                  top of the profile already carries it. */}
              {(p.businessCategory || p.businessType) && (
                <div className="mt-2 text-xs text-stone-500 capitalize">
                  {(p.businessCategory || p.businessType) as string}
                </div>
              )}
              {p.businessAddress && (
                <div className="mt-3 text-sm text-stone-600">{p.businessAddress as string}</div>
              )}
              {p.businessHours && (
                <div className="mt-3">
                  <div className="section-label">Hours</div>
                  <div className="mt-1 text-sm text-stone-700">{p.businessHours as string}</div>
                </div>
              )}
              {p.businessPhone && (
                <a href={`tel:${p.businessPhone}`} className="mt-3 block text-sm text-stone-700 hover:text-indigo-700">
                  {p.businessPhone as string}
                </a>
              )}
              {/* Leave-a-review moved to the profile action row (ActionBar's
                  "Leave a Google review"); hidden here to avoid duplication. */}
            </div>
          )}

          {hasLocation && (
            <div className="card-soft overflow-hidden">
              <div className="section-label px-5 pt-5 pb-4">Location</div>
              {location && <div className="px-5 pb-4 -mt-2 text-sm text-stone-600">{location}</div>}
              <MiniMap lat={p.latitude as number} lng={p.longitude as number} color={pinColor} />
              {p.googleMapsUrl && (
                <a
                  href={p.googleMapsUrl as string}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 border-t border-stone-100 py-3 text-xs text-indigo-700 hover:bg-stone-50 transition"
                >
                  Open in Google Maps →
                </a>
              )}
            </div>
          )}

          {p.reviewsSummary && (
            <Section title="What people say">
              <blockquote className="border-l-2 border-indigo-200 pl-4 italic text-stone-700">
                &ldquo;{p.reviewsSummary as string}&rdquo;
              </blockquote>
            </Section>
          )}

          {(services.length > 0 || specialties.length > 0) && (
            <Section title="What they offer">
              <Tags items={[...services, ...specialties]} color="indigo" />
            </Section>
          )}

          {menuHighlights.length > 0 && (
            <Section title="Menu highlights">
              <Tags items={menuHighlights} color="emerald" />
            </Section>
          )}

          {p.discipline && (
            <Section title="Discipline">
              <p className="text-stone-800">{p.discipline as string}</p>
            </Section>
          )}

          {venueTypes.length > 0 && (
            <Section title="Venues & events they play">
              <Tags items={venueTypes} />
            </Section>
          )}

          {p.yearsExperience && (
            <Section title="Experience">
              <p className="text-stone-800">{p.yearsExperience as string}</p>
            </Section>
          )}

          {p.cause && (
            <Section title="Cause / Community">
              <p className="text-stone-800">{p.cause as string}</p>
            </Section>
          )}

          {memberType === "organizer" && readServes(p).length > 0 && (
            <Section title="Who they serve">
              <div className="flex flex-wrap gap-2">
                {readServes(p).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700"
                  >
                    {focusLabel(s)}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {needsMost.length > 0 && (
            <Section title="What they need most">
              <Tags items={needsMost} />
            </Section>
          )}

          {connectWith.length > 0 && (
            <Section title="Looking to connect with">
              <Tags items={connectWith} />
            </Section>
          )}

          {goals.length > 0 && (
            <Section title="Goals">
              <ul className="space-y-1.5">
                {goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-stone-800">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    {g}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {interests.length > 0 && (
            <Section title="Interests">
              <Tags items={interests} />
            </Section>
          )}

          {shareTypes.length > 0 && (
            <Section title="They share">
              <Tags items={shareTypes} />
            </Section>
          )}

          {memberType !== "organizer" && (
            <Section title="Events">
              {vendorEvents.length > 0 && (
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  {vendorEvents.map((ev) => (
                    <Link key={ev.id} href={`/events/${ev.id}`} className="card-soft card-hover group flex items-stretch gap-3 p-3">
                      {ev.poster_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ev.poster_image_url} alt={ev.title} className="w-20 shrink-0 self-stretch rounded-lg object-cover" />
                      ) : (
                        <div className="w-20 shrink-0 self-stretch rounded-lg bg-gradient-to-br from-indigo-300 to-purple-500" />
                      )}
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="truncate font-medium text-stone-900">{ev.title}</div>
                        <div className="mt-1 truncate text-sm text-stone-500">
                          {[ev.event_date, ev.event_time].filter(Boolean).join(" · ")}
                        </div>
                        {ev.location && <div className="truncate text-sm text-stone-500">{ev.location}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {events.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {events.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </div>
              ) : vendorEvents.length > 0 ? null : (
                <></>
              )}
            </Section>
          )}

          {broadcasts.length > 0 && (
            <Section title="Live & watch parties">
              <div className="grid gap-3 sm:grid-cols-2">
                {broadcasts.map((b) => {
                  const live = isLive(b);
                  const cover = b.image_urls?.[0];
                  return (
                    <Link key={b.id} href={`/live/${b.id}`} className="card-soft card-hover group flex items-stretch gap-3 p-3">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt={b.whats_on || "broadcast"} className="w-20 shrink-0 self-stretch rounded-lg object-cover" />
                      ) : (
                        <div className="flex w-20 shrink-0 items-center justify-center self-stretch rounded-lg bg-gradient-to-br from-rose-300 to-orange-400 text-2xl">
                          {eventEmoji(b.event_slug)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium text-stone-500">{liveEventLabel(b.event_slug, b.event_label)}</span>
                          {live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live
                            </span>
                          )}
                        </div>
                        <div className="truncate font-medium text-stone-900">
                          {b.whats_on || liveEventLabel(b.event_slug, b.event_label)}
                        </div>
                        <div className="mt-0.5 truncate text-sm text-stone-500">
                          {live
                            ? timeLeftLabel(b.ends_at)
                            : new Date(b.starts_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          <BusinessFacets
            memberId={id}
            initialSize={p.businessSize as string | undefined}
            initialOwnership={readOwnership(p)}
            canEdit={canEditFacets}
          />

          <GivesBackBadges memberId={id} memberName={name} />

          {/* Posting happens IN CONTEXT — you post from the page the post lands
              on, so "where does this go?" answers itself. (The global "+" in the
              top nav is gone; the event + broadcast pages have the same CTA.) */}
          <Link
            href={`/share?business=${id}&businessName=${encodeURIComponent(name)}`}
            className="flex items-center justify-between rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            <span className="text-sm font-medium text-stone-800">📸 Been here? Post a photo</span>
            <span className="text-sm font-medium text-indigo-700">Share →</span>
          </Link>

          <MemoriesGrid memberId={id} title={`Tagged at ${name}`} />

          <ShopSection
            memberId={id}
            memberName={name}
            supabaseProducts={supabaseProducts}
            apiProducts={products}
            priceRange={p.priceRange as string | undefined}
            featuredProduct={p.featuredProduct as string | undefined}
            shopUrl={shopUrl || undefined}
          />
        </main>

        {/* Sidebar */}
        <aside className="space-y-6">
          {memberType === "organizer" && (
            <div className="card-soft p-4">
              <div className="section-label">Events</div>
              <ul className="mt-3 space-y-3">
                {events.map((e) => ({
                  id: e.id,
                  title: e.title || "Untitled event",
                  date: e.date || "",
                  location: e.location || "",
                  gradient: TYPE_GRADIENTS[memberType] ?? "from-emerald-300 to-teal-500",
                })).map((ev) => (
                  <li key={ev.id}>
                    <Link
                      href={`/events/${ev.id}`}
                      className="group flex items-stretch gap-3 rounded-lg p-1 -m-1 transition hover:bg-stone-50"
                    >
                      <div className={`shrink-0 self-stretch w-14 rounded-md bg-gradient-to-br ${ev.gradient}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-stone-900 group-hover:text-indigo-700">
                          {ev.title}
                        </div>
                        <div className="text-xs text-stone-500">{ev.date}</div>
                        <div className="truncate text-xs text-stone-500">{ev.location}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasSocials && (
            <div className="card-soft p-4">
              <div className="section-label">Find them online</div>
              <ul className="mt-3 space-y-2 text-sm">
                {p.instagramHandle && <li><SocialLink href={`https://instagram.com/${p.instagramHandle}`} label={`@${p.instagramHandle}`} icon={<InstagramIcon className="h-4 w-4" />} /></li>}
                {p.tiktokHandle && <li><SocialLink href={`https://tiktok.com/@${p.tiktokHandle}`} label={`@${p.tiktokHandle}`} icon="🎵" /></li>}
                {(p.twitterHandle || p.xHandle) && <li><SocialLink href={`https://x.com/${p.twitterHandle || p.xHandle}`} label={`@${p.twitterHandle || p.xHandle}`} icon="𝕏" /></li>}
                {p.threadsHandle && <li><SocialLink href={`https://threads.net/@${p.threadsHandle}`} label={`@${p.threadsHandle}`} icon="🧵" /></li>}
                {(p.youtubeUrl || p.youtubeHandle) && <li><SocialLink href={p.youtubeUrl as string || `https://youtube.com/@${p.youtubeHandle}`} label="YouTube" icon="▶️" /></li>}
                {p.linkedinUrl && <li><SocialLink href={p.linkedinUrl as string} label="LinkedIn" icon="💼" /></li>}
                {p.spotifyUrl && <li><SocialLink href={p.spotifyUrl as string} label="Spotify" icon="🎧" /></li>}
                {p.soundcloudUrl && <li><SocialLink href={p.soundcloudUrl as string} label="SoundCloud" icon="☁️" /></li>}
                {p.facebookUrl && <li><SocialLink href={p.facebookUrl as string} label="Facebook" icon="👥" /></li>}
                {p.eventbriteUrl && <li><SocialLink href={p.eventbriteUrl as string} label="Eventbrite" icon="🎟️" /></li>}
                {p.bandsintownUrl && <li><SocialLink href={p.bandsintownUrl as string} label="Bandsintown" icon="🎸" /></li>}
                {p.songkickUrl && <li><SocialLink href={p.songkickUrl as string} label="Songkick" icon="🎤" /></li>}
                {p.meetupUrl && <li><SocialLink href={p.meetupUrl as string} label="Meetup" icon="🤝" /></li>}
                {p.pinterestUrl && <li><SocialLink href={p.pinterestUrl as string} label="Pinterest" icon="📌" /></li>}
                {extraSocials.map(([key, val]) => {
                  const label = key.replace(/(Handle|Url)$/, "").replace(/([A-Z])/g, " $1").trim();
                  return <li key={key}><SocialLink href={val as string} label={label} icon="🔗" /></li>;
                })}
              </ul>
            </div>
          )}

        </aside>
      </div>

      {/* Unclaimed profile banner — placed at the bottom so it doesn't dominate the page */}
      {member.status === 'unclaimed' && (
        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Is this your business?</p>
          <p className="mt-1 text-sm text-amber-700">Claim this profile to manage it, receive payments, and connect with customers.</p>
          <Link href={`/claim/${member.id}`} className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800">
            Claim this business
          </Link>
        </div>
      )}

      {/* Customer-service assistant — a Member+ capability (text agent), Pro adds
          voice. Free/unclaimed listings don't show it. */}
      {hasAssistant && (
        <AskAssistant memberId={id} memberName={(p.businessName as string) || name} />
      )}
    </div>
  );
}
