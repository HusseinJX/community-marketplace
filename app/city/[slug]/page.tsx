import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberCard } from "@/components/MemberCard";
import { CollectionJsonLd } from "@/components/JsonLd";
import { SITE_NAME } from "@/lib/seo";
import { citiesFrom, fetchAllMembers, membersInCity } from "@/lib/landing";

export async function generateStaticParams() {
  const cities = citiesFrom(await fetchAllMembers());
  return cities.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cities = citiesFrom(await fetchAllMembers());
  const city = cities.find((c) => c.slug === slug);
  if (!city) return { title: "Place not found", robots: { index: false, follow: true } };

  const title = `Local makers & businesses in ${city.name}`;
  const description = `Discover ${city.count} local vendors, artists, and organizers in ${city.name} on ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: `/city/${slug}` },
    openGraph: {
      title,
      description,
      url: `/city/${slug}`,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const all = await fetchAllMembers();
  const cities = citiesFrom(all);
  const city = cities.find((c) => c.slug === slug);
  if (!city) notFound();

  const members = membersInCity(all, slug);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-8">
      <CollectionJsonLd
        name={`Local makers & businesses in ${city.name}`}
        description={`Local vendors, artists, and organizers in ${city.name}.`}
        path={`/city/${slug}`}
        members={members}
      />

      <nav className="text-sm text-stone-500">
        <Link href="/" className="hover:text-indigo-700">Browse</Link>
        <span className="px-1.5">/</span>
        <Link href="/city" className="hover:text-indigo-700">Places</Link>
        <span className="px-1.5">/</span>
        <span className="text-stone-700">{city.name}</span>
      </nav>

      <header className="mt-4 border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          Local in {city.name}
        </h1>
        <p className="mt-2 text-stone-600">
          {members.length} local {members.length === 1 ? "listing" : "listings"} in {city.name}.
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <MemberCard key={m.id} member={m} />
        ))}
      </div>

      {cities.length > 1 && (
        <section className="mt-16 border-t border-stone-200 pt-8">
          <div className="section-label">Other places</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cities
              .filter((c) => c.slug !== slug)
              .slice(0, 30)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/city/${c.slug}`}
                  className="rounded-full bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                >
                  {c.name}
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
