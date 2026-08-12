import { Suspense } from "react";
import Link from "next/link";
import { Calendar, MapPin, Clock, UserRound, ExternalLink } from "lucide-react";
import { isScrapedHost } from "@/lib/sources/persist";
import { listEvents, getMember } from "@/lib/api";
import type { EventSuggestion, Member } from "@/lib/types";
import { getVendorEventById } from "@/lib/vendor-connect";
import { getAcceptedLineup } from "@/lib/collab-network";
import { isDemoMode } from "@/lib/demo-admin";
import { demoMemberId } from "@/lib/demo-server";
import { demoEvents, demoLineup, isDemoEventId } from "@/lib/demo-organize";
import { getPostsByEventId } from "@/lib/posts";
import { groupByRole } from "@/lib/lineup-roles";
import { isEventOrganizer } from "@/lib/org-focus";
import { EventActionBar } from "./EventActionBar";
import { BackToHome } from "@/components/BackToHome";
import { MemoriesGrid } from "@/components/posts/MemoriesGrid";
import { TicketBox } from "@/components/events/TicketBox";
import { SaveEventButton } from "@/components/events/SaveEventButton";
import { EventLocationMap } from "@/components/events/EventLocationMap";
import { NearbyBusinesses } from "@/components/events/NearbyBusinesses";

// ─── Gradient helpers ────────────────────────────────────────────────────────

const gradients = [
  "from-emerald-300 to-teal-500",
  "from-indigo-300 to-purple-500",
  "from-amber-300 to-orange-500",
  "from-pink-300 to-rose-500",
  "from-sky-300 to-blue-500",
  "from-lime-300 to-emerald-500",
];

/**
 * Placeholder while the nearby rail streams in.
 *
 * Deliberately quiet — no heading. `NearbyBusinesses` returns null when the
 * event has nothing within five miles, and a skeleton headed "Nearby
 * businesses" would announce a section that is about to disappear.
 */
function NearbyBusinessesSkeleton() {
  return (
    <div className="mt-12 border-t border-stone-100 pt-8">
      <div className="h-6 w-48 animate-pulse rounded bg-stone-100" />
      <div className="-mx-4 mt-4 flex gap-4 overflow-hidden px-4 md:-mx-8 md:px-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-44 shrink-0 sm:w-52">
            <div className="aspect-square animate-pulse rounded-xl bg-stone-100" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function gradientFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return gradients[h % gradients.length];
}

function attendanceFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 12 + (h % 89);
}

const DEMO_EVENTS: Record<string, EventSuggestion> = {
  "demo-e1": {
    id: "demo-e1",
    memberId: "89516919-256f-4a95-96df-fc9d285f664a",
    memberName: "Zahab Energy",
    title: "Free Solar Consultation Day",
    date: "Sat, Jun 7",
    time: "10:00 AM – 2:00 PM",
    location: "Downtown LA Maker Space",
    description: "Meet our engineers for a one-on-one rooftop assessment. Learn about incentives, tax credits, and custom install quotes — no pressure.",
    source: { platform: "In-person" },
    status: "approved",
  },
  "demo-e2": {
    id: "demo-e2",
    memberId: "89516919-256f-4a95-96df-fc9d285f664a",
    memberName: "Zahab Energy",
    title: "Clean Energy Workshop",
    date: "Thu, Jun 19",
    time: "6:00 PM – 8:00 PM",
    location: "Echo Park Community Center",
    description: "Hands-on intro to home solar + battery systems. Walk through real installs, costs, and the new CA incentive programs.",
    source: { platform: "Free" },
    status: "approved",
  },
  "demo-e3": {
    id: "demo-e3",
    memberId: "89516919-256f-4a95-96df-fc9d285f664a",
    memberName: "Zahab Energy",
    title: "Sustainable Living Expo 2026",
    date: "Sat, Jul 12",
    time: "9:00 AM – 5:00 PM",
    location: "Grand Park, Los Angeles",
    description: "Stop by booth 14 for live demos, giveaways, and exclusive expo pricing on our full product line.",
    source: { platform: "Expo" },
    status: "approved",
  },
};

// ─── Page (server component) ─────────────────────────────────────────────────

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let event: EventSuggestion | undefined = DEMO_EVENTS[id];
  let isOrganizerEvent = false;
  let posterUrl: string | null = null;
  let eventLat: number | null = null;
  let eventLng: number | null = null;
  /** The source's own listing, for harvested events. */
  let sourceUrl: string | null = null;
  // `vendor_events` FIRST, connector second — the reverse of how this read.
  //
  // 694 of the 697 live events are rows in vendor_events (every harvested
  // event, every organiser event); the connector holds a handful. Asking the
  // connector first meant fetching its ENTIRE event list, ~600ms, finding
  // nothing, and only then doing the single indexed lookup that was always
  // going to answer — on essentially every event page load.
  //
  // Ids do not collide: the two sources are deduped into one feed, and where a
  // record exists in both, the vendor_events row is the richer one (poster,
  // coordinates, source URL), so preferring it is also the better answer.
  if (!event) {
    const ve = await getVendorEventById(id);
    if (ve) {
      isOrganizerEvent = true;
      posterUrl = ve.poster_image_url;
      eventLat = ve.lat;
      eventLng = ve.lng;
      sourceUrl = ve.event_url;
      event = {
        id: ve.id,
        memberId: ve.member_id,
        memberName: ve.member_name ?? undefined,
        title: ve.title,
        description: ve.description ?? undefined,
        date: ve.event_date ?? undefined,
        time: ve.event_time ?? undefined,
        location: ve.location ?? undefined,
        source: { platform: "In-person" },
        status: "approved",
      };
    }
  }
  // Demo events (so the in-portal "Event page" preview renders without a real DB row).
  if (!event && isDemoMode() && isDemoEventId(id)) {
    const de = demoEvents(await demoMemberId()).find((e) => e.id === id);
    if (de) {
      isOrganizerEvent = true;
      eventLat = de.lat;
      eventLng = de.lng;
      event = {
        id: de.id,
        memberId: de.member_id,
        memberName: de.member_name ?? undefined,
        title: de.title,
        description: de.description ?? undefined,
        date: de.event_date ?? undefined,
        time: de.event_time ?? undefined,
        location: de.location ?? undefined,
        source: { platform: "In-person" },
        status: "approved",
      };
    }
  }

  // The connector's own events — a handful, and the only ones not in
  // vendor_events. Now a LAST resort rather than the first thing tried: this
  // fetches its whole event list, so it only runs for an id nothing else
  // claimed, instead of on every page view.
  if (!event) {
    const { events } = await listEvents();
    event = events.find((e) => e.id === id);
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-stone-500 text-lg mb-6">Event not found.</p>
          <BackToHome className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline" />
        </div>
      </main>
    );
  }

  // Fetch host member — but NOT for a harvested event.
  //
  // A scraped event's host is a synthetic id (`source:sfpl`), minted precisely
  // because there is no business behind it. 669 of the 672 live events carry
  // one, so this call was made on 99.6% of event pages, could never resolve,
  // blocked the render while it tried, and had its result thrown away — the
  // byline falls back to `event.memberName` for exactly these events anyway.
  //
  // It also cost more than it looked. The connector fetch is cached for 300s,
  // and an expired entry does NOT serve stale here (that is the full-route
  // cache, and these pages are dynamic) — it blocks. So every five minutes one
  // visitor paid ~1.9s for an answer we already knew was nothing: measured
  // 1.0s warm, 2.83s on the first request after the window lapsed.
  //
  // `scrapedHost` is computed here rather than further down, where it was only
  // being used to decide whether the byline should be a link.
  const scrapedHost = isScrapedHost(event.memberId);
  let member: Member | null = null;
  if (!scrapedHost) {
    try {
      const res = await getMember(event.memberId);
      member = res.member;
    } catch {
      // silently fall back
    }
  }

  const profile = member?.profile ?? {};
  const hostName =
    (profile.name as string | undefined) ||
    event.memberName ||
    "Unknown host";
  const hostBio =
    (profile.approvedBlurb as string | undefined) ||
    (profile.bio as string | undefined) ||
    (profile.businessDescription as string | undefined) ||
    null;
  const hostLocation = [
    profile.neighborhood as string | undefined,
    profile.city as string | undefined,
  ]
    .filter(Boolean)
    .join(", ");

  // Map pin: the event's own coordinates (set on the create form), falling back
  // to the host business's location so every event with a located host maps.
  const pinLat =
    eventLat ?? (typeof profile.latitude === "number" ? profile.latitude : null);
  const pinLng =
    eventLng ?? (typeof profile.longitude === "number" ? profile.longitude : null);

  // Confirmed lineup (vendors, performers, sponsors, …) for organizer/festival
  // events. Empty for connector/demo events — the section self-hides.
  const acceptedLineup =
    isDemoMode() && isDemoEventId(event.id)
      ? demoLineup(event.id, event.memberId).filter((i) => i.status === "accepted")
      : await getAcceptedLineup(event.id);
  const lineupGroups = groupByRole(acceptedLineup);
  const isFestival = isEventOrganizer(profile);

  // Image-first hero: the event poster, else a real photo from the memories
  // wall, else a gradient. Sell the experience, Airbnb-style.
  const memories = await getPostsByEventId(event.id).catch(() => []);
  const heroImage =
    posterUrl ||
    (profile.imageUrl as string | undefined) ||
    memories.flatMap((p) => p.image_urls)[0] ||
    null;

  const title = event.title || "Untitled event";
  const description =
    event.reworded || event.description || event.originalExcerpt || "";
  const grad = gradientFor(title);
  const attendance = attendanceFor(event.id);

  // No hardcoded back destination. BackToHome resolves it from where you
  // actually came from: the host's profile if you opened the event there (the
  // profile records itself via RememberOrigin), otherwise the home tab you were
  // browsing. Forcing "back to the host" sent people who arrived from the Events
  // tab to a profile they'd never seen.

  // A harvested event has no host — it has a SOURCE. Rendering "Hosted by
  // Funcheap SF" with an avatar and a bio card states something false: they
  // listed it, they aren't putting it on. So for these the host card goes and
  // the credit is a single line that says what actually happened.
  //
  // (`scrapedHost` is declared above, where it now also decides whether the
  // host lookup is worth making at all.)

  // "What to expect" is gone: it restated the time, the place and the host —
  // all of which are already in the header three inches above — inside four
  // cards, and the one line left ("open to all") is the chip at the top.

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-3 sm:pb-12 sm:pt-4">
        {/* Back link. Tight to the header and tight to the hero — it used to
            reserve a band of empty screen above the photo on a phone. */}
        <BackToHome className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-indigo-700" />

        {/* Hero — image-first, gradient fallback */}
        {heroImage ? (
          <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        ) : (
          <div className={`aspect-[16/7] w-full rounded-2xl bg-gradient-to-br ${grad} mb-8`} />
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white uppercase tracking-wide">
              Event
            </span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Open to all
            </span>
            {isFestival && (
              <span className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                Public event
              </span>
            )}
          </div>

          <div className="mb-4 flex items-start justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 leading-tight">
              {title}
            </h1>
            {/* Not everyone who opens an event is ready to RSVP — a star lets
                them keep it without committing to a ticket. */}
            <SaveEventButton eventId={event.id} variant="inline" className="mt-1.5 shrink-0" />
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600 mb-4">
            {event.date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4 text-stone-400" />
                {event.date}
                {event.time && (
                  <>
                    <span className="text-stone-300 mx-0.5">·</span>
                    <Clock className="size-4 text-stone-400" />
                    {event.time}
                  </>
                )}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-stone-400" />
                {event.location}
              </span>
            )}
          </div>

          {member && (
            <div className="flex items-center gap-2 text-sm mb-6">
              <span className="text-stone-500">Hosted by</span>
              <Link
                href={`/members/${event.memberId}`}
                className="font-medium text-indigo-700 hover:underline flex items-center gap-1"
              >
                {hostName}
                <ExternalLink className="size-3" />
              </Link>
            </div>
          )}

          <EventActionBar title={title} eventId={event.id} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {description && (
              <section>
                <p className="section-label mb-4">About this event</p>
                <p className="text-stone-700 leading-relaxed">{description}</p>
              </section>
            )}

            {/* About the host — only when there IS one. */}
            {scrapedHost ? (
              <p className="text-sm text-stone-500">
                Listed by <span className="font-medium text-stone-700">{hostName}</span>
                {sourceUrl ? (
                  <>
                    {" · "}
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                    >
                      Event details
                      <ExternalLink className="size-3" />
                    </a>
                  </>
                ) : null}
              </p>
            ) : (
              <section>
                <p className="section-label mb-4">About the host</p>
                <div className="card-soft p-4 flex gap-4">
                  <div
                    className={`size-14 shrink-0 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-xl`}
                  >
                    {hostName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/members/${event.memberId}`}
                      className="font-semibold text-stone-900 hover:text-indigo-700 transition"
                    >
                      {hostName}
                    </Link>
                    {hostLocation && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        {hostLocation}
                      </p>
                    )}
                    {hostBio && (
                      <p className="mt-2 text-sm text-stone-700 leading-relaxed line-clamp-4">
                        {hostBio}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Lineup — confirmed vendors, performers, sponsors, etc. */}
            {lineupGroups.length > 0 && (
              <section>
                <p className="section-label mb-4">Lineup</p>
                <div className="space-y-5">
                  {lineupGroups.map((g) => (
                    <div key={g.role.key}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                        {g.role.emoji} {g.role.plural} ({g.items.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {g.items.map((it) => (
                          <Link
                            key={it.id}
                            href={`/members/${it.to_id}`}
                            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:border-indigo-300 hover:text-indigo-700"
                          >
                            {it.to_name || "Member"}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Post a memory — closes the show-up → post loop (feeds discovery) */}
            <Link
              href={`/share?event=${event.id}&eventTitle=${encodeURIComponent(title)}`}
              className="flex items-center justify-between rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="text-sm font-medium text-stone-800">📸 Were you there? Post a memory</span>
              <span className="text-sm font-medium text-indigo-700">Share →</span>
            </Link>

            {/* Community memories — everyone's photos tagged to this event */}
            <MemoriesGrid eventId={event.id} title="Memories" subtitle="From everyone who came" />
          </div>

          {/* Aside */}
          <div className="space-y-4">
            {/* When & where */}
            <div className="card-soft p-4">
              <p className="section-label mb-4">When &amp; where</p>
              <div className="space-y-3 text-sm text-stone-700">
                {event.date && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className="size-4 text-stone-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{event.date}</p>
                      {event.time && (
                        <p className="text-stone-500">{event.time}</p>
                      )}
                    </div>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-stone-400 shrink-0 mt-0.5" />
                    <p>{event.location}</p>
                  </div>
                )}
                {pinLat != null && pinLng != null && (
                  <EventLocationMap
                    lat={pinLat}
                    lng={pinLng}
                    label={event.location || hostName}
                  />
                )}
                <div className="flex items-start gap-2.5">
                  <UserRound className="size-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-stone-500 text-xs mb-0.5">
                      {scrapedHost ? "Listed by" : "Hosted by"}
                    </p>
                    {/* A source id has no profile page — linking it produced a
                        dead /members/source:funcheap link. */}
                    {scrapedHost ? (
                      <p className="font-medium text-stone-800">{hostName}</p>
                    ) : (
                      <Link
                        href={`/members/${event.memberId}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {hostName}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance */}
            <div className="card-soft p-4">
              <p className="section-label mb-4">Attendance</p>
              {isOrganizerEvent ? (
                // TicketBox renders the tier picker when the organizer has defined
                // ticket types, and falls back to the plain RSVP button when they
                // haven't — the visitor shouldn't have to know which kind of event
                // this is.
                <TicketBox eventId={event.id} />
              ) : (
                <>
                  <div className="flex -space-x-2 mb-3">
                    {Array.from({ length: Math.min(5, attendance) }).map((_, i) => {
                      const g = gradients[(i * 7 + 3) % gradients.length];
                      return (
                        <div
                          key={i}
                          className={`size-8 rounded-full bg-gradient-to-br ${g} border-2 border-white`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-sm text-stone-700">
                    <span className="font-semibold text-stone-900">{attendance}</span> people going
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* What else is on that block when you get there. Full width under both
            columns, and it self-hides when the event has no pin or nothing is
            close — an empty "nearby" rail is worse than no rail. */}
        {/* STREAMED, not awaited inline. This section reads the whole member
            directory and renders dozens of cards — roughly 600KB of the ~670KB
            this page used to weigh — and none of it is the event. Awaited in
            place it held the FIRST BYTE of the page hostage: the title, date and
            RSVP button were ready in milliseconds and sat behind a rail nobody
            has scrolled to yet. Inside Suspense the event paints immediately and
            this arrives when it's ready. */}
        {pinLat != null && pinLng != null && (
          <Suspense fallback={<NearbyBusinessesSkeleton />}>
            <NearbyBusinesses lat={pinLat} lng={pinLng} excludeMemberId={event.memberId} />
          </Suspense>
        )}
      </div>
    </main>
  );
}
