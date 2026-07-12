import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";
import { CATEGORIES } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Browse by category",
  description: `Explore local businesses, makers, and organizers by category on ${SITE_NAME}.`,
  alternates: { canonical: "/category" },
};

export default function CategoryIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-8">
      <header className="border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          Browse by category
        </h1>
        <p className="mt-2 text-stone-600">
          Find local vendors, artists, and organizers by what they do.
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className="card-soft px-4 py-3 text-stone-800 transition hover:text-indigo-700"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
