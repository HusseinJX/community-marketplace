"use client";

import { useEffect, useState } from "react";
import { listEvents } from "@/lib/api";
import type { EventSuggestion } from "@/lib/types";
import { EventCard } from "@/components/EventCard";

export default function EventsPage() {
  const [events, setEvents] = useState<EventSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEvents({ limit: 50 })
      .then(res => {
        if (!cancelled) setEvents(res.events);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || "Failed to load events.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Community Events
        </h1>
        <p className="mt-3 max-w-2xl text-base text-stone-600">
          Hand-picked events surfaced from neighbors, organizers, and venues
          around the community.
        </p>
      </header>

      {loading && (
        <div className="py-20 text-center text-stone-500">Loading events...</div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/40 p-12 text-center">
          <p className="text-base text-stone-700">No events posted yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Check back soon — community events will appear here as they are
            approved.
          </p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {events.map(ev => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
