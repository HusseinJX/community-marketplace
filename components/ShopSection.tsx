"use client";

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

function makeProductId(memberId: string, productName: string) {
  return `${memberId}__${productName}`;
}

function makeProduct(
  memberId: string,
  memberName: string,
  productName: string,
  price?: number
) {
  return {
    id: makeProductId(memberId, productName),
    name: productName,
    memberId,
    memberName,
    price,
  };
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
    supabaseProducts.length > 0 ||
    apiProducts.length > 0 ||
    priceRange ||
    featuredProduct ||
    shopUrl;

  if (!hasContent) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
        Shop &amp; Products
      </h2>
      {priceRange && (
        <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          {priceRange}
        </span>
      )}
      {supabaseProducts.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {supabaseProducts.map((sp) => {
            const prod = makeProduct(memberId, memberName, sp.name, sp.price);
            const priceStr = `$${(sp.price / 100).toFixed(2)}`;
            return (
              <div
                key={sp.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">{sp.name}</p>
                  {sp.description && (
                    <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">{sp.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-emerald-700">{priceStr}</span>
                  <button
                    onClick={() => toggleFavorite(prod)}
                    title={isFavorite(prod.id) ? "Remove from favorites" : "Save to favorites"}
                    className="rounded-full p-1 text-sm hover:bg-stone-200 transition-colors"
                  >
                    {isFavorite(prod.id) ? "❤️" : "🤍"}
                  </button>
                  <button
                    onClick={() => isInCart(prod.id) ? removeFromCart(prod.id) : addToCart(prod)}
                    title={isInCart(prod.id) ? "Remove from cart" : "Add to cart"}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isInCart(prod.id)
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-white border border-stone-200 text-stone-700 hover:border-indigo-300 hover:text-indigo-700"
                    }`}
                  >
                    {isInCart(prod.id) ? "In cart" : "+ Cart"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {featuredProduct && (() => {
            const prod = makeProduct(memberId, memberName, featuredProduct);
            return (
              <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Featured</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-base font-medium text-indigo-900">{featuredProduct}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleFavorite(prod)}
                      title={isFavorite(prod.id) ? "Remove from favorites" : "Save to favorites"}
                      className="rounded-full p-1.5 text-sm hover:bg-indigo-100 transition-colors"
                    >
                      {isFavorite(prod.id) ? "❤️" : "🤍"}
                    </button>
                    <button
                      onClick={() => isInCart(prod.id) ? removeFromCart(prod.id) : addToCart(prod)}
                      title={isInCart(prod.id) ? "Remove from cart" : "Add to cart"}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isInCart(prod.id)
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      {isInCart(prod.id) ? "In cart" : "+ Cart"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          {apiProducts.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {apiProducts.map((productName) => {
                const prod = makeProduct(memberId, memberName, productName);
                return (
                  <div
                    key={productName}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5"
                  >
                    <span className="text-sm text-stone-800">{productName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleFavorite(prod)}
                        title={isFavorite(prod.id) ? "Remove from favorites" : "Save to favorites"}
                        className="rounded-full p-1 text-sm hover:bg-stone-200 transition-colors"
                      >
                        {isFavorite(prod.id) ? "❤️" : "🤍"}
                      </button>
                      <button
                        onClick={() => isInCart(prod.id) ? removeFromCart(prod.id) : addToCart(prod)}
                        title={isInCart(prod.id) ? "Remove from cart" : "Add to cart"}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          isInCart(prod.id)
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-white border border-stone-200 text-stone-700 hover:border-indigo-300 hover:text-indigo-700"
                        }`}
                      >
                        {isInCart(prod.id) ? "In cart" : "+ Cart"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {shopUrl && (
        <a
          href={shopUrl.startsWith("http") ? shopUrl : `https://${shopUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:underline"
        >
          Visit shop &rarr;
        </a>
      )}
    </section>
  );
}
