import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberCard } from "@/components/MemberCard";
import { CollectionJsonLd } from "@/components/JsonLd";
import { SITE_NAME } from "@/lib/seo";
import {
  CATEGORIES,
  categoryFromSlug,
  fetchAllMembers,
  membersInCategory,
} from "@/lib/landing";

// Directory-backed page: regenerate daily, not per crawler hit.
export const revalidate = 86400;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryFromSlug(slug);
  if (!cat) return { title: "Category not found", robots: { index: false, follow: true } };

  const title = `${cat.name} — local businesses & makers`;
  const description = `Browse local ${cat.name.toLowerCase()} businesses, makers, and services near you on ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title,
      description,
      url: `/category/${slug}`,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = categoryFromSlug(slug);
  if (!cat) notFound();

  const all = await fetchAllMembers();
  const members = membersInCategory(all, slug);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-8">
      <CollectionJsonLd
        name={`${cat.name} on ${SITE_NAME}`}
        description={`Local ${cat.name} businesses and makers.`}
        path={`/category/${slug}`}
        members={members}
      />

      <nav className="text-sm text-stone-500">
        <Link href="/browse" className="hover:text-indigo-700">Browse</Link>
        <span className="px-1.5">/</span>
        <Link href="/category" className="hover:text-indigo-700">Categories</Link>
        <span className="px-1.5">/</span>
        <span className="text-stone-700">{cat.name}</span>
      </nav>

      <header className="mt-4 border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          {cat.name}
        </h1>
        <p className="mt-2 text-stone-600">
          {members.length > 0
            ? `${members.length} local ${members.length === 1 ? "listing" : "listings"} in ${cat.name}.`
            : `No listings in ${cat.name} yet — check back soon.`}
        </p>
      </header>

      {members.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}

      <section className="mt-16 border-t border-stone-200 pt-8">
        <div className="section-label">Other categories</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.slug !== slug).map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="rounded-full bg-white px-3 py-1.5 text-sm text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
