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
import { getProductsByMember, getVendorEventsByMember, type SupabaseProduct, type VendorEvent } from "@/lib/vendor-connect";
import { getDemoMember } from "@/lib/demo-members";
import { MemberTypeBadge } from "@/components/MemberTypeBadge";
import { EventCard } from "@/components/EventCard";
import { MiniMap } from "@/components/MiniMap";
import { ShopSection } from "@/components/ShopSection";
import { ActionBar } from "@/components/ActionBar";
import { GroupChat } from "@/components/GroupChat";
import { ImageCarousel } from "@/components/ImageCarousel";
import { AskAssistant } from "@/components/AskAssistant";
import { MEMBER_HERO_IMAGES } from "@/lib/member-images";
import { usableImages, isPlaceholder } from "@/lib/image-utils";
import { ENDORSEMENTS } from "@/lib/endorsements";
import { EndorsementRows } from "@/components/EndorsementRows";

const DEMO_EVENTS = [
  {
    id: "demo-e1",
    title: "Free Solar Consultation Day",
    date: "Sat, Jun 7",
    time: "10:00 AM – 2:00 PM",
    location: "Downtown LA Maker Space",
    description: "Meet our engineers for a one-on-one rooftop assessment. Learn about incentives, tax credits, and custom install quotes — no pressure.",
    gradient: "from-amber-300 to-orange-500",
    platform: "In-person",
  },
  {
    id: "demo-e2",
    title: "Clean Energy Workshop",
    date: "Thu, Jun 19",
    time: "6:00 PM – 8:00 PM",
    location: "Echo Park Community Center",
    description: "Hands-on intro to home solar + battery systems. Walk through real installs, costs, and the new CA incentive programs.",
    gradient: "from-emerald-300 to-teal-500",
    platform: "Free",
  },
  {
    id: "demo-e3",
    title: "Sustainable Living Expo 2026",
    date: "Sat, Jul 12",
    time: "9:00 AM – 5:00 PM",
    location: "Grand Park, Los Angeles",
    description: "Stop by booth 14 for live demos, giveaways, and exclusive expo pricing on our full product line.",
    gradient: "from-sky-300 to-indigo-500",
    platform: "Expo",
  },
];

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

function SocialLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-indigo-700 hover:underline">
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

// Resolve a member from demo data or the connector API. `getMember` uses fetch,
// which Next memoizes — so calling this in both generateMetadata and the page
// for the same id hits the network at most once per request.
async function resolveMember(id: string): Promise<Member | null> {
  const demo = getDemoMember(id);
  if (demo) return demo;
  try {
    return (await getMember(id)).member;
  } catch {
    return null;
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
  let fetchError: string | null = null;

  const demo = getDemoMember(id);
  if (demo) {
    member = demo;
  } else {
    try {
      const [memberRes, eventsRes, prods, vEvents] = await Promise.all([
        getMember(id),
        listEvents({ memberId: id, limit: 20 }),
        getProductsByMember(id),
        getVendorEventsByMember(id),
      ]);
      member = memberRes.member;
      events = eventsRes.events;
      supabaseProducts = prods;
      vendorEvents = vEvents;
    } catch (err) {
      fetchError = err instanceof Error ? err.message : "Failed to load profile.";
    }
  }

  if (fetchError || !member) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
          ← Back to browse
        </Link>
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
    if (k === "websiteUrl" || k === "googleMapsUrl") return false;
    return k.endsWith("Handle") || k.endsWith("Url");
  });

  const hasSocials = [...knownSocialKeys].some((k) => p[k]) || extraSocials.length > 0;
  const hasLocation = typeof p.latitude === "number" && typeof p.longitude === "number";
  const memberTypeColor: Record<string, string> = {
    vendor: "#3B82F6", artist: "#8B5CF6", organizer: "#10B981",
    shopper: "#F97316", influencer: "#EC4899",
  };
  const pinColor = memberTypeColor[memberType] ?? "#6B7280";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-8">
      {isIndexable(member) && <MemberJsonLd member={member} />}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
        ← Back to browse
      </Link>

      {/* Hero */}
      {(() => {
        const curated = MEMBER_HERO_IMAGES[id];
        const apiImages = Array.isArray(p.images) ? usableImages(p.images as string[]) : [];
        const single = typeof p.imageUrl === "string" && !isPlaceholder(p.imageUrl) ? [p.imageUrl] : [];
        const heroImages = (curated && curated.length ? curated : apiImages.length ? apiImages : single);
        return heroImages.length > 0 ? (
          <div className="mt-6">
            <ImageCarousel images={heroImages} alt={name} aspect="wide" fallbackGradient={gradient} priority />
          </div>
        ) : (
          <div className={`mt-6 aspect-[21/9] w-full rounded-2xl bg-gradient-to-br ${gradient}`} />
        );
      })()}

      {/* Header */}
      <header className="mt-8 border-b border-stone-200 pb-8">
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
        <ActionBar memberName={name} memberId={id} isVendor={memberType === "vendor"} />
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
                <p className="leading-relaxed text-stone-800">{bio}</p>
              </Section>
            )
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
                    <div key={ev.id} className="card-soft group flex items-stretch gap-3 p-3">
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
                    </div>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {DEMO_EVENTS.map((ev) => (
                    <Link
                      key={ev.id}
                      href={`/events/${ev.id}`}
                      className="card-soft group flex items-stretch gap-3 p-3 transition hover:shadow-md"
                    >
                      <div className={`shrink-0 self-stretch w-20 rounded-lg bg-gradient-to-br ${ev.gradient}`} />
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="truncate font-medium text-stone-900 group-hover:text-indigo-700">
                          {ev.title}
                        </div>
                        <div className="mt-1 text-sm text-stone-500">{ev.date}</div>
                        <div className="truncate text-sm text-stone-500">{ev.location}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          )}

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
            <div className="card-soft p-5">
              <div className="section-label">Events</div>
              <ul className="mt-3 space-y-3">
                {(events.length > 0
                  ? events.map((e) => ({
                      id: e.id,
                      title: e.title || "Untitled event",
                      date: e.date || "",
                      location: e.location || "",
                      gradient: TYPE_GRADIENTS[memberType] ?? "from-emerald-300 to-teal-500",
                    }))
                  : DEMO_EVENTS.map((e) => ({
                      id: e.id,
                      title: e.title,
                      date: e.date,
                      location: e.location,
                      gradient: e.gradient,
                    }))
                ).map((ev) => (
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

          {hasBusiness && (
            <div className="card-soft p-5">
              <div className="section-label">Business</div>
              {p.businessName && (
                <div className="mt-2 text-base font-semibold text-stone-900">{p.businessName as string}</div>
              )}
              {(p.businessCategory || p.businessType) && (
                <div className="text-xs text-stone-500 capitalize">
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
              {p.websiteUrl && (
                <a
                  href={(p.websiteUrl as string).startsWith("http") ? p.websiteUrl as string : `https://${p.websiteUrl}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"
                >
                  Visit website →
                </a>
              )}
            </div>
          )}

          {hasSocials && (
            <div className="card-soft p-5">
              <div className="section-label">Find them online</div>
              <ul className="mt-3 space-y-2 text-sm">
                {p.instagramHandle && <li><SocialLink href={`https://instagram.com/${p.instagramHandle}`} label={`@${p.instagramHandle}`} icon="📸" /></li>}
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
        </aside>
      </div>

      {/* Unclaimed profile banner — placed at the bottom so it doesn't dominate the page */}
      {member.status === 'unclaimed' && (
        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Is this your business?</p>
          <p className="mt-1 text-sm text-amber-700">Claim this profile to manage it, receive payments, and connect with customers.</p>
          <Link href={`/claim/${member.id}`} className="mt-3 inline-block rounded-lg bg-amber-900 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800">
            Claim this business
          </Link>
        </div>
      )}

      {/* Auto-provisioned customer-service assistant for every business */}
      {["vendor", "artist", "organizer"].includes(memberType) && (
        <AskAssistant memberId={id} memberName={(p.businessName as string) || name} />
      )}
    </div>
  );
}
