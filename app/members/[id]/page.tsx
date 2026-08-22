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
import { getProductsByMember, getVendorEventsByMember, getVendorSettings, type SupabaseProduct, type VendorEvent } from "@/lib/vendor-connect";
import { ALL_PLATFORMS, platformById, type CustomLink, type StoredLink } from "@/lib/links";

// Everything the profile can show in its social row: any platform whose value
// lives on the member profile. Phone and Website are excluded — the action bar
// already has a "Visit website" button and a tel: link of its own, and showing
// them twice in one header is noise.
const SOCIAL_ROW_PLATFORMS = ALL_PLATFORMS.filter(
  (plat) => plat.profileField && plat.id !== "website" && plat.id !== "phone",
);
import { PlatformIcon } from "@/components/join/PlatformIcon";
import { getBroadcastsByMember, type Broadcast } from "@/lib/broadcasts";
import { isLive, eventEmoji, eventLabel as liveEventLabel, timeLeftLabel } from "@/lib/live-events";
import { MemberTypeBadge } from "@/components/MemberTypeBadge";
import { EventCard } from "@/components/EventCard";
import { MiniMap } from "@/components/MiniMap";
import { ShopSection } from "@/components/ShopSection";
import { ActionBar } from "@/components/ActionBar";
import { GroupChat } from "@/components/GroupChat";
import { PhotoMosaic } from "@/components/business/PhotoMosaic";
import { AskAssistant } from "@/components/AskAssistant";
import { getEntitlements } from "@/lib/entitlements";
import { memberImages } from "@/lib/member-images";
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

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="group flex items-center gap-2.5 t-body text-stone-700 transition hover:text-stone-900">
      {/* No grey-to-dark hover on the glyph: the mark is drawn in the brand's
          own colour, so recolouring it on hover changes the logo. The label
          carries the hover instead. */}
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="truncate">{label}</span>
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
  // Support + free links (vendor_settings, migration 20260813180000). The 13
  // social platforms live on the member profile and are read below; these two
  // don't, because support links are EXTERNAL money and must stay structurally
  // apart from anything purchasable. See lib/links.ts.
  let supportLinks: StoredLink[] = [];
  let otherLinks: StoredLink[] = [];
  let customLinks: CustomLink[] = [];
  let fetchError: string | null = null;

  try {
    const [memberRes, eventsRes, prods, vEvents, bcasts, settings] = await Promise.all([
      getMember(id),
      listEvents({ memberId: id, limit: 20 }),
      getProductsByMember(id),
      getVendorEventsByMember(id),
      // includeExpired → the venue's full live history (past + current), so
      // people can browse what they've shown, not just what's on right now.
      getBroadcastsByMember(id, true),
      getVendorSettings(id),
    ]);
    member = memberRes.member;
    events = eventsRes.events;
    supabaseProducts = prods;
    vendorEvents = vEvents;
    broadcasts = bcasts;
    supportLinks = settings?.support_links ?? [];
    otherLinks = settings?.other_links ?? [];
    customLinks = settings?.custom_links ?? [];
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

  // The social row on the profile action bar, built FROM THE CATALOGUE
  // (lib/links) rather than from a hand-written list.
  //
  // It used to be thirteen hard-coded entries, each with an emoji standing in
  // for a logo (📸 Instagram, 🎵 TikTok, 💼 LinkedIn) and its own copy of how
  // to build the href. Two problems, both real: the marks were not the brands,
  // and the list could drift from the one the links step writes — a platform
  // added at onboarding would save fine and then never appear here.
  //
  // Now: every catalogue platform that stores to a profile field, in catalogue
  // order, drawn with its real mark. Adding a platform to lib/links puts it on
  // the profile automatically.
  const socialLinks = SOCIAL_ROW_PLATFORMS.flatMap((plat) => {
    const raw = p[plat.profileField as keyof typeof p];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return [];
    return [{ href: plat.href(value), label: plat.label, platformId: plat.id }];
  })
    // `x` and the legacy `twitter` are the same account and the same
    // destination, so a member with both fields set would get two identical X
    // buttons. First one wins — the catalogue puts the current field first.
    .filter((s, i, arr) => arr.findIndex((o) => o.href === s.href) === i);

  // The same set again, but carrying the platform and the raw value, for the
  // sidebar list that prints the handle rather than just the mark.
  const socialDetails = SOCIAL_ROW_PLATFORMS.flatMap((plat) => {
    const raw = p[plat.profileField as keyof typeof p];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return [];
    return [{ plat, value, href: plat.href(value) }];
  }).filter((d, i, arr) => arr.findIndex((o) => o.href === d.href) === i);

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
      {/* Hero — a photo mosaic on desktop, the carousel on a phone.
          See components/business/PhotoMosaic. */}
      {(() => {
        // lib/member-images owns the precedence — the owner's own list first.
        const heroImages = memberImages({ id, profile: p });
        return (
          <div className="mt-2 md:mt-6">
            <PhotoMosaic images={heroImages} alt={name} gradientClass={gradient} />
          </div>
        );
      })()}

      {/* Header */}
      <header className="mt-4 border-b border-stone-200 pb-5 md:mt-8 md:pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-hero text-stone-900">{name}</h1>
          <MemberTypeBadge type={p.memberType} />
        </div>
        {/* One line of facts under the title, dot-separated — category and
            place read as a single sentence about what this is and where.
            They used to be a grey line plus a row of grey chips saying the
            same two words, which is three visual elements for one idea. */}
        {(location || p.category || p.subcategory) && (
          <div className="mt-2 t-lead font-normal text-stone-500">
            {[p.category as string | undefined, p.subcategory as string | undefined, location]
              .filter(Boolean)
              .join(" · ")}
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
          lat={typeof p.latitude === "number" ? p.latitude : null}
          lng={typeof p.longitude === "number" ? p.longitude : null}
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

          {/* Where they already sell, and how to reach them — the shop and
              contact links that have no field on the member profile (Toast, a
              delivery listing, their own app, an email address). Ordinary
              outbound links, so unlike Support they need no disclaimer; they
              are simply the other places this business exists. */}
          {otherLinks.length > 0 && (
            <div className="card-soft p-5">
              <div className="section-label">Also find them on</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {otherLinks.map((l) => {
                  const plat = platformById(l.id);
                  if (!plat) return null;
                  return (
                    <a
                      key={l.id}
                      href={plat.href(l.value)}
                      target={plat.href(l.value).startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${plat.tile}`} aria-hidden>
                        <PlatformIcon platform={plat.id} className="h-3.5 w-3.5" />
                      </span>
                      {plat.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Support + other links, from the onboarding links step.
              A SEPARATE card from anything purchasable, and that separation is
              the point rather than the layout: these are external — the money
              goes straight to the business, we take no fee and there is no
              order. Rendering them beside a Buy button would misrepresent both
              (App Store 3.1.1). The line under the heading says so out loud. */}
          {supportLinks.length > 0 && (
            <div className="card-soft p-5">
              <div className="section-label">Support {name}</div>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                Goes directly to them — not through WhatsLocal.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {supportLinks.map((l) => {
                  const plat = platformById(l.id);
                  if (!plat) return null;
                  return (
                    <a
                      key={l.id}
                      href={plat.href(l.value)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${plat.tile}`} aria-hidden>
                        <PlatformIcon platform={plat.id} className="h-3.5 w-3.5" />
                      </span>
                      {plat.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {customLinks.length > 0 && (
            <div className="card-soft p-5">
              <div className="section-label">Links</div>
              <div className="mt-3 space-y-1.5">
                {customLinks.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="block truncate text-sm text-stone-700 underline underline-offset-2 hover:text-stone-900"
                  >
                    {l.title}
                  </a>
                ))}
              </div>
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
            <Section title="Games shown here">
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

        {/* Sidebar.
            Sticky on desktop: the facts a visitor keeps coming back for — where
            they are, how to reach them — were scrolling away behind a page that
            can run very long (about, hours, map, memories, the whole shop). On
            a phone it stays in normal flow, stacked under the main column,
            because there is nothing beside it to stick to. */}
        <aside className="space-y-6 lg:sticky lg:self-start" style={{ top: "calc(var(--top-nav) + 1rem + env(safe-area-inset-top))" }}>
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

          {/* "Find them online" — the full list, with a handle you can read.
              The action row above is icon-only and made for a glance; this is
              the one you scan when you actually want their Instagram.

              Same catalogue as everything else (lib/links), same marks. This
              was the THIRD hand-written copy of the platform list on this page,
              with its own icon set (components/business/SocialIcons, now
              deleted) and its own href rules — so a platform could render three
              different ways, or be missing from one of them. */}
          {socialDetails.length > 0 && (
            <div className="card-soft p-4">
              <div className="section-label">Find them online</div>
              <ul className="mt-3 space-y-2.5">
                {socialDetails.map(({ plat, value, href }) => (
                  <li key={plat.id}>
                    <SocialLink
                      href={href}
                      label={plat.input === "handle" ? `@${value.replace(/^@/, "")}` : plat.label}
                      icon={<PlatformIcon platform={plat.id} className="h-4 w-4" brand />}
                    />
                  </li>
                ))}
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
