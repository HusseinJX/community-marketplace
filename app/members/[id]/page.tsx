"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getMember, listEvents } from "@/lib/api";
import type { Member, EventSuggestion } from "@/lib/types";
import { MemberTypeBadge } from "@/components/MemberTypeBadge";
import { EventCard } from "@/components/EventCard";

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
      .catch(err => {
        if (!cancelled) setError(err.message || "Failed to load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
  const name = p.name || "Anonymous member";
  const location = [p.neighborhood, p.city].filter(Boolean).join(", ");
  const interests = p.interests ?? [];
  const goals = p.goals ?? [];
  const bio = p.approvedBlurb || p.personalNote || p.notes || "";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/"
        className="text-sm font-medium text-indigo-700 hover:underline"
      >
        &larr; Back to browse
      </Link>

      <header className="mt-6 flex flex-col gap-3 border-b border-stone-200 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {name}
          </h1>
          <MemberTypeBadge type={p.memberType} size="md" />
        </div>
        {location && <p className="text-base text-stone-600">{location}</p>}
        {p.vibe && (
          <p className="text-sm italic text-stone-500">&ldquo;{p.vibe}&rdquo;</p>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {bio && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                About
              </h2>
              <p className="mt-2 whitespace-pre-line text-base text-stone-800">
                {bio}
              </p>
            </section>
          )}

          {goals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Goals
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-stone-800">
                {goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </section>
          )}

          {interests.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Interests
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {interests.map(i => (
                  <span
                    key={i}
                    className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {(p.businessName || p.website || p.description) && (
          <aside className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Business
            </h2>
            {p.businessName && (
              <p className="mt-2 text-base font-semibold text-stone-900">
                {p.businessName}
              </p>
            )}
            {p.description && (
              <p className="mt-2 text-sm text-stone-700">{p.description}</p>
            )}
            {p.website && (
              <a
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:underline"
              >
                Visit website &rarr;
              </a>
            )}
          </aside>
        )}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-stone-900">Events</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            No upcoming events from this member yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {events.map(ev => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
