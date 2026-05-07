"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getMember, listEvents } from "@/lib/api";
import type { Member, EventSuggestion } from "@/lib/types";
import { MemberTypeBadge } from "@/components/MemberTypeBadge";
import { EventCard } from "@/components/EventCard";
import { MiniMap } from "@/components/MiniMap";

function Tags({ items, color = "stone" }: { items: string[]; color?: string }) {
  const cls =
    color === "indigo"
      ? "bg-indigo-50 text-indigo-700"
      : color === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-stone-100 text-stone-700";
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-sm ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-indigo-700 hover:underline"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [member, setMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<EventSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getMember(id), listEvents({ memberId: id, limit: 20 })])
      .then(([m, ev]) => {
        if (cancelled) return;
        setMember(m.member);
        setEvents(ev.events);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center text-stone-500">
        Loading profile...
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link href="/" className="text-sm text-indigo-700 hover:underline">
          &larr; Back to browse
        </Link>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error || "Member not found."}
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

  // Known social platform fields (hardcoded display)
  const knownSocialKeys = new Set([
    "instagramHandle", "tiktokHandle", "facebookUrl", "eventbriteUrl",
    "bandsintownUrl", "songkickUrl", "meetupUrl", "youtubeUrl", "youtubeHandle",
    "twitterHandle", "xHandle", "linkedinUrl", "spotifyUrl", "threadsHandle",
    "pinterestUrl", "soundcloudUrl", "etsyUrl", "shopifyUrl",
  ]);

  // Dynamic catch-all: any *Handle or *Url field not already known or shown elsewhere
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
  const pinColor = memberTypeColor[p.memberType as string] ?? "#6B7280";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm font-medium text-indigo-700 hover:underline">
        &larr; Back to browse
      </Link>

      {/* Header */}
      <header className="mt-6 flex flex-col gap-3 border-b border-stone-200 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {name}
          </h1>
          <MemberTypeBadge type={p.memberType} size="md" />
        </div>
        {location && <p className="text-base text-stone-500">{location}</p>}
        {(p.category || p.subcategory) && (
          <div className="flex items-center gap-2">
            {p.category && (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {p.category as string}
              </span>
            )}
            {p.subcategory && (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {p.subcategory as string}
              </span>
            )}
          </div>
        )}
        {p.vibe && (
          <p className="text-sm italic text-stone-400">&ldquo;{p.vibe as string}&rdquo;</p>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">

          {bio && (
            <Section title="About">
              <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-stone-800">
                {bio}
              </p>
            </Section>
          )}

          {p.reviewsSummary && (
            <Section title="What people say">
              <p className="mt-2 text-base italic leading-relaxed text-stone-700">
                &ldquo;{p.reviewsSummary as string}&rdquo;
              </p>
            </Section>
          )}

          {(services.length > 0 || specialties.length > 0) && (
            <Section title="What they offer">
              <Tags items={[...services, ...specialties]} color="indigo" />
            </Section>
          )}

          {(products.length > 0 || p.priceRange || p.featuredProduct || shopUrl) && (
            <Section title="Shop & Products">
              {p.priceRange && (
                <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  {p.priceRange as string}
                </span>
              )}
              {p.featuredProduct && (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Featured</p>
                  <p className="mt-1 text-base font-medium text-indigo-900">{p.featuredProduct as string}</p>
                </div>
              )}
              {products.length > 0 && <Tags items={products} color="stone" />}
              {shopUrl && (
                <a
                  href={shopUrl.startsWith("http") ? shopUrl : `https://${shopUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline"
                >
                  Visit shop &rarr;
                </a>
              )}
            </Section>
          )}

          {menuHighlights.length > 0 && (
            <Section title="Menu highlights">
              <Tags items={menuHighlights} color="emerald" />
            </Section>
          )}

          {/* Artist-specific */}
          {p.discipline && (
            <Section title="Discipline">
              <p className="mt-2 text-base text-stone-800">{p.discipline as string}</p>
            </Section>
          )}

          {venueTypes.length > 0 && (
            <Section title="Venues & events they play">
              <Tags items={venueTypes} />
            </Section>
          )}

          {p.yearsExperience && (
            <Section title="Experience">
              <p className="mt-2 text-base text-stone-800">{p.yearsExperience as string}</p>
            </Section>
          )}

          {/* Organizer-specific */}
          {p.cause && (
            <Section title="Cause / Community">
              <p className="mt-2 text-base text-stone-800">{p.cause as string}</p>
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
              <ul className="mt-2 space-y-1.5">
                {goals.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-base text-stone-800">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
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
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {hasBusiness && (
            <aside className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                Business
              </h2>
              {p.businessName && (
                <p className="text-base font-semibold text-stone-900">{p.businessName as string}</p>
              )}
              {(p.businessCategory || p.businessType) && (
                <p className="text-xs text-stone-500 capitalize">
                  {(p.businessCategory || p.businessType) as string}
                </p>
              )}
              {p.businessAddress && (
                <p className="text-sm text-stone-600">{p.businessAddress as string}</p>
              )}
              {p.businessHours && (
                <div>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Hours</p>
                  <p className="mt-0.5 text-sm text-stone-600">{p.businessHours as string}</p>
                </div>
              )}
              {p.businessPhone && (
                <a href={`tel:${p.businessPhone}`} className="block text-sm text-stone-700 hover:text-indigo-700">
                  {p.businessPhone as string}
                </a>
              )}
              {p.websiteUrl && (
                <a
                  href={(p.websiteUrl as string).startsWith("http") ? p.websiteUrl as string : `https://${p.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-medium text-indigo-700 hover:underline"
                >
                  Visit website &rarr;
                </a>
              )}
            </aside>
          )}

          {hasSocials && (
            <aside className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                Find them online
              </h2>
              {p.instagramHandle && (
                <SocialLink
                  href={`https://instagram.com/${p.instagramHandle}`}
                  label={`@${p.instagramHandle}`}
                  icon="📸"
                />
              )}
              {p.tiktokHandle && (
                <SocialLink
                  href={`https://tiktok.com/@${p.tiktokHandle}`}
                  label={`@${p.tiktokHandle}`}
                  icon="🎵"
                />
              )}
              {(p.twitterHandle || p.xHandle) && (
                <SocialLink
                  href={`https://x.com/${p.twitterHandle || p.xHandle}`}
                  label={`@${p.twitterHandle || p.xHandle}`}
                  icon="𝕏"
                />
              )}
              {p.threadsHandle && (
                <SocialLink
                  href={`https://threads.net/@${p.threadsHandle}`}
                  label={`@${p.threadsHandle}`}
                  icon="🧵"
                />
              )}
              {(p.youtubeUrl || p.youtubeHandle) && (
                <SocialLink
                  href={p.youtubeUrl as string || `https://youtube.com/@${p.youtubeHandle}`}
                  label="YouTube"
                  icon="▶️"
                />
              )}
              {p.linkedinUrl && (
                <SocialLink href={p.linkedinUrl as string} label="LinkedIn" icon="💼" />
              )}
              {p.spotifyUrl && (
                <SocialLink href={p.spotifyUrl as string} label="Spotify" icon="🎧" />
              )}
              {p.soundcloudUrl && (
                <SocialLink href={p.soundcloudUrl as string} label="SoundCloud" icon="☁️" />
              )}
              {p.facebookUrl && (
                <SocialLink href={p.facebookUrl as string} label="Facebook" icon="👥" />
              )}
              {p.eventbriteUrl && (
                <SocialLink href={p.eventbriteUrl as string} label="Eventbrite" icon="🎟️" />
              )}
              {p.bandsintownUrl && (
                <SocialLink href={p.bandsintownUrl as string} label="Bandsintown" icon="🎸" />
              )}
              {p.songkickUrl && (
                <SocialLink href={p.songkickUrl as string} label="Songkick" icon="🎤" />
              )}
              {p.meetupUrl && (
                <SocialLink href={p.meetupUrl as string} label="Meetup" icon="🤝" />
              )}
              {p.pinterestUrl && (
                <SocialLink href={p.pinterestUrl as string} label="Pinterest" icon="📌" />
              )}
              {extraSocials.map(([key, val]) => {
                const label = key.replace(/(Handle|Url)$/, "").replace(/([A-Z])/g, " $1").trim();
                return (
                  <SocialLink key={key} href={val as string} label={label} icon="🔗" />
                );
              })}
            </aside>
          )}
          {hasLocation && (
            <aside className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
              <MiniMap
                lat={p.latitude as number}
                lng={p.longitude as number}
                color={pinColor}
              />
              {p.googleMapsUrl && (
                <a
                  href={p.googleMapsUrl as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-indigo-700 hover:bg-stone-50 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Open in Google Maps
                </a>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Events */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-stone-900">Events</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No upcoming events from this member yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
