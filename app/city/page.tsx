import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";
import { citiesFrom, fetchAllMembers } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Browse by place",
  description: `Explore local businesses, makers, and organizers by city on ${SITE_NAME}.`,
  alternates: { canonical: "/city" },
};

export default async function CityIndexPage() {
  const cities = citiesFrom(await fetchAllMembers());

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-8">
      <header className="border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          Browse by place
        </h1>
        <p className="mt-2 text-stone-600">
          Discover the local makers and businesses near you, city by city.
        </p>
      </header>

      {cities.length === 0 ? (
        <p className="mt-8 text-stone-500">No places to show yet — check back soon.</p>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <Link
              key={c.slug}
              href={`/city/${c.slug}`}
              className="card-soft flex items-center justify-between px-4 py-3 text-stone-800 transition hover:shadow-md hover:text-indigo-700"
            >
              <span>{c.name}</span>
              <span className="text-xs text-stone-400">{c.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
