"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import type { SupabaseProduct } from "@/lib/vendor-connect";
import { useStore } from "@/lib/store";

interface ShopSectionProps {
  memberId: string;
  memberName: string;
  supabaseProducts: SupabaseProduct[];
  apiProducts: string[];
  priceRange?: string;
  featuredProduct?: string;
  shopUrl?: string;
}

const PRODUCT_GRADIENTS = [
  "from-amber-300 to-orange-400",
  "from-sky-300 to-blue-400",
  "from-violet-300 to-purple-400",
  "from-emerald-300 to-teal-400",
  "from-rose-300 to-pink-400",
  "from-indigo-300 to-blue-400",
];

function productGradient(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PRODUCT_GRADIENTS[h % PRODUCT_GRADIENTS.length];
}

function makeProductId(memberId: string, productName: string) {
  return `${memberId}__${productName}`;
}

function makeProduct(memberId: string, memberName: string, productName: string, price?: number) {
  return { id: makeProductId(memberId, productName), name: productName, memberId, memberName, price };
}

export function ShopSection({
  memberId,
  memberName,
  supabaseProducts,
  apiProducts,
  priceRange,
  featuredProduct,
  shopUrl,
}: ShopSectionProps) {
  const { toggleFavorite, isFavorite, addToCart, removeFromCart, isInCart } = useStore();

  const hasContent =
    supabaseProducts.length > 0 || apiProducts.length > 0 || priceRange || featuredProduct || shopUrl;
  if (!hasContent) return null;

  // Auto-derive price range from supabase products if not given
  const derivedRange =
    priceRange ??
    (supabaseProducts.length > 0
      ? (() => {
          const prices = supabaseProducts.map((p) => p.price / 100);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          return min === max ? `$${min}` : `$${min} – $${max}`;
        })()
      : undefined);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="section-label">Shop &amp; Products</h2>
        <div className="flex items-center gap-3">
          {derivedRange && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {derivedRange}
            </span>
          )}
          {shopUrl && (
            <a
              href={shopUrl.startsWith("http") ? shopUrl : `https://${shopUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
            >
              Visit shop →
            </a>
          )}
        </div>
      </div>

      {supabaseProducts.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {supabaseProducts.map((sp) => {
            const prod = makeProduct(memberId, memberName, sp.name, sp.price);
            const inC = isInCart(prod.id);
            const fav = isFavorite(prod.id);
            const grad = productGradient(sp.name);
            const priceStr = `$${(sp.price / 100).toFixed(2)}`;
            return (
              // A thumbnail beside the text, not a full-bleed square above it.
              // A product photo is a label here, not the content — at
              // `aspect-square w-full` one product filled a phone screen, and a
              // gradient PLACEHOLDER filled it while saying nothing at all.
              <div key={sp.id} className="flex items-start gap-3 overflow-hidden rounded-xl border border-stone-100 bg-stone-50 p-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                  {sp.image_url ? (
                    <Image
                      src={sp.image_url}
                      alt={sp.name}
                      fill
                      className="object-cover"
                      // Fixed 80px box, so ask the optimizer for that and not a
                      // viewport-width file (see the memory note in
                      // PersonalizedEvents — decoded RAM scales with pixels).
                      sizes="80px"
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${grad}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900">{sp.name}</div>
                      {sp.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-stone-600">{sp.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(prod)}
                        aria-label="Favorite"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:scale-110 hover:text-rose-500"
                      >
                        <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : ""}`} />
                      </button>
                      <button
                        onClick={() => (inC ? removeFromCart(prod.id) : addToCart(prod))}
                        className={
                          "rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
                          (inC
                            ? "bg-indigo-600 text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-indigo-300 hover:text-indigo-700")
                        }
                      >
                        {inC ? "In cart" : "+ Add to cart"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-emerald-700">{priceStr}</div>
                  <div className="mt-0.5 text-[11px] text-stone-400">by {memberName}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {supabaseProducts.length === 0 && (
        <>
          {featuredProduct && (() => {
            const prod = makeProduct(memberId, memberName, featuredProduct);
            const inC = isInCart(prod.id);
            const fav = isFavorite(prod.id);
            const grad = productGradient(featuredProduct);
            return (
              <div className="mt-4 flex items-start gap-3 overflow-hidden rounded-xl border border-stone-100 bg-stone-50 p-3">
                <div className={`h-20 w-20 shrink-0 rounded-lg bg-gradient-to-br ${grad}`} />
                <div className="min-w-0 flex-1">
                  <p className="section-label">Featured</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-stone-900">{featuredProduct}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(prod)}
                        aria-label="Favorite"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:scale-110 hover:text-rose-500"
                      >
                        <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : ""}`} />
                      </button>
                      <button
                        onClick={() => (inC ? removeFromCart(prod.id) : addToCart(prod))}
                        className={
                          "rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
                          (inC
                            ? "bg-indigo-600 text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-indigo-300 hover:text-indigo-700")
                        }
                      >
                        {inC ? "In cart" : "+ Add to cart"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-400">by {memberName}</div>
                </div>
              </div>
            );
          })()}

          {apiProducts.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {apiProducts.map((productName) => {
                const prod = makeProduct(memberId, memberName, productName);
                const inC = isInCart(prod.id);
                const fav = isFavorite(prod.id);
                const grad = productGradient(productName);
                return (
                  <div key={productName} className="flex items-start gap-3 overflow-hidden rounded-xl border border-stone-100 bg-stone-50 p-3">
                    <div className={`h-20 w-20 shrink-0 rounded-lg bg-gradient-to-br ${grad}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate text-sm font-medium text-stone-900">{productName}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleFavorite(prod)}
                            aria-label="Favorite"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:scale-110 hover:text-rose-500"
                          >
                            <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : ""}`} />
                          </button>
                          <button
                            onClick={() => (inC ? removeFromCart(prod.id) : addToCart(prod))}
                            className={
                              "rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
                              (inC
                                ? "bg-indigo-600 text-white"
                                : "border border-stone-200 bg-white text-stone-700 hover:border-indigo-300 hover:text-indigo-700")
                            }
                          >
                            {inC ? "In cart" : "+ Add to cart"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-stone-400">by {memberName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
