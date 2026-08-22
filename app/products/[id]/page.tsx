import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import { getProductById, getProductsByMember } from "@/lib/vendor-connect";
import { baseName } from "@/lib/product-variants";
import { ProductBuy } from "@/components/shop/ProductBuy";
import { kindOf, KIND_DEFS } from "@/lib/product-kind";

// A product's own page. Server-rendered, like the member profile it belongs
// to, because the price and the seller are the two things that must never be
// a client's opinion.
//
// It exists because the storefront had no destination: a card could be
// favourited or added to a basket, but there was nowhere to read what the
// thing actually was. The description a vendor wrote had no surface at all.

function priceLabel(cents: number, currency = "usd"): string {
  if (cents === 0) return "Free";
  const d = cents / 100;
  const s = d % 1 === 0 ? `${d}` : d.toFixed(2);
  return currency.toLowerCase() === "usd" ? `$${s}` : `${s} ${currency.toUpperCase()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Product not found", robots: { index: false, follow: false } };

  return {
    title: `${baseName(product.name)} — ${product.member_name}`,
    description:
      product.description?.slice(0, 160) ||
      `${baseName(product.name)} from ${product.member_name}, on WhatsLocal.`,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: product.image_url ? { images: [product.image_url] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);

  // Missing or delisted. NOT filtered on hidden-members: that list keeps a
  // business out of the directory, and a product page is not a directory entry
  // — see the note in lib/hidden-members.ts.
  if (!product) notFound();

  const kind = kindOf(product.kind);
  const catalogue = await getProductsByMember(product.member_id);

  // Everything that is the same THING as this row: the other sizes and colours
  // Printify prices separately and the importer therefore stored as their own
  // rows. A hand-made product has no siblings and gets a picker of one, which
  // renders as a plain price.
  const pid = (product as unknown as { printify_product_id?: string | null }).printify_product_id;
  const variants = (pid ? catalogue.filter((p) => (p as unknown as { printify_product_id?: string | null }).printify_product_id === pid) : [product])
    .sort((a, b) => a.price - b.price);
  const listingName = baseName(product.name);

  // "More from" must not offer the same shirt in another size as if it were
  // another product.
  const siblings = catalogue
    .filter((p) => !variants.some((v) => v.id === p.id))
    .filter((p, i, arr) => arr.findIndex((q) => baseName(q.name) === baseName(p.name)) === i)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:px-8">
      <Link
        href="/?tab=products"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>

      <ProductBuy
        alt={listingName}
        currency={product.currency}
        memberId={product.member_id}
        memberName={product.member_name}
        variants={variants.map((v) => ({
          id: v.id,
          label: v.name.slice(listingName.length).replace(/^ — /, ""),
          price: v.price,
          name: v.name,
          // The gallery of THIS variant. A row imported before the gallery
          // existed still has its cover, so the page never renders empty while
          // waiting for a re-sync.
          images: v.image_urls?.length ? v.image_urls : v.image_url ? [v.image_url] : [],
        }))}
      >
        <Link
          href={`/members/${product.member_id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-stone-900"
        >
          <Store className="h-4 w-4" /> {product.member_name}
        </Link>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          {listingName}
        </h1>

        {kind !== "good" && (
          <span className="mt-3 inline-block rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
            {KIND_DEFS[kind].label}
          </span>
        )}

        {product.description && (
          <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-stone-700">
            {product.description}
          </p>
        )}

        {/* No ratings, no review count, no "12 people are viewing this".
            Nothing in this app records any of it, and inventing it is how a
            storefront stops being worth believing. */}
        <p className="mt-4 text-[13px] text-stone-500">
          Sold by {product.member_name}. You pay them directly — WhatsLocal takes 5% of the item
          price.
        </p>
      </ProductBuy>

      {siblings.length > 0 && (
        <section className="mt-14">
          <h2 className="section-label mb-3">More from {product.member_name}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {siblings.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                  {p.image_url && (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="(min-width:768px) 220px, 50vw"
                      className="object-cover transition group-hover:scale-[1.02]"
                    />
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-stone-900">{baseName(p.name)}</p>
                <p className="text-sm text-stone-600">{priceLabel(p.price, p.currency)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
