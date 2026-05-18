import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  UserRound,
  Users,
  Clock,
  ExternalLink,
} from "lucide-react";
import { listEvents, getMember } from "@/lib/api";
import type { EventSuggestion, Member } from "@/lib/types";
import { EventActionBar } from "./EventActionBar";

// ─── Gradient helpers ────────────────────────────────────────────────────────

const gradients = [
  "from-emerald-300 to-teal-500",
  "from-indigo-300 to-purple-500",
  "from-amber-300 to-orange-500",
  "from-pink-300 to-rose-500",
  "from-sky-300 to-blue-500",
  "from-lime-300 to-emerald-500",
];

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
  if (!event) {
    const { events } = await listEvents();
    event = events.find((e) => e.id === id);
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-stone-500 text-lg mb-6">Event not found.</p>
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to events
          </Link>
        </div>
      </main>
    );
  }

  // Fetch host member
  let member: Member | null = null;
  try {
    const res = await getMember(event.memberId);
    member = res.member;
  } catch {
    // silently fall back
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

  const title = event.title || "Untitled event";
  const description =
    event.reworded || event.description || event.originalExcerpt || "";
  const grad = gradientFor(title);
  const attendance = attendanceFor(event.id);

  const backHref = event.memberId ? `/members/${event.memberId}` : "/events";
  const backLabel =
    event.memberId && member ? `Back to ${hostName}` : "Back to events";

  const expectItems: { icon: ComponentType<{ className?: string }>; text: string }[] = [
    { icon: Users, text: "Open to all community members" },
    {
      icon: Clock,
      text: event.time ? `Starts at ${event.time}` : "Check time with host",
    },
    { icon: MapPin, text: event.location || "Location TBD" },
    { icon: UserRound, text: `Hosted by ${hostName}` },
  ];

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        {/* Back link */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-indigo-700 transition mb-6"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        {/* Hero banner */}
        <div
          className={`aspect-[16/7] w-full rounded-2xl bg-gradient-to-br ${grad} mb-8`}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white uppercase tracking-wide">
              Event
            </span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Open to all
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4 leading-tight">
            {title}
          </h1>

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

          <EventActionBar title={title} />
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

            {/* What to expect */}
            <section>
              <p className="section-label mb-4">What to expect</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {expectItems.map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    className="card-soft flex items-start gap-3 p-4"
                  >
                    <Icon className="size-5 text-indigo-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-stone-700">{text}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* About the host */}
            <section>
              <p className="section-label mb-4">About the host</p>
              <div className="card-soft p-5 flex gap-4">
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
          </div>

          {/* Aside */}
          <div className="space-y-4">
            {/* When & where */}
            <div className="card-soft p-5">
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
                <div className="flex items-start gap-2.5">
                  <UserRound className="size-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-stone-500 text-xs mb-0.5">Hosted by</p>
                    <Link
                      href={`/members/${event.memberId}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {hostName}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance */}
            <div className="card-soft p-5">
              <p className="section-label mb-4">Attendance</p>
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
                <span className="font-semibold text-stone-900">
                  {attendance}
                </span>{" "}
                people going
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
