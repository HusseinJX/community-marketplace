"use client";

import Link from "next/link";
import { ArrowLeft, Heart, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const {
    cart,
    removeFromCart,
    clearCart,
    toggleFavorite,
    isFavorite,
    incrementCartItem,
    decrementCartItem,
  } = useStore();
  const router = useRouter();

  const totalItems = cart.reduce((n, p) => n + (p.qty ?? 1), 0);
  const subtotal = cart.reduce((sum, p) => sum + (p.price ?? 0) * (p.qty ?? 1), 0);
  const vendorIds = Array.from(new Map(cart.map((p) => [p.memberId, p])).values());

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
      <Link href="/browse" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      <div className="mt-6 flex items-center justify-between">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-stone-900">
          Cart
          {totalItems > 0 && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
              {totalItems}
            </span>
          )}
        </h1>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-sm text-stone-500 transition hover:text-rose-600"
          >
            Clear all
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="card-soft mt-10 flex flex-col items-center justify-center px-6 py-20 text-center">
          <ShoppingBag className="h-10 w-10 text-stone-300" />
          <p className="mt-4 text-base text-stone-700">
            Your cart is empty. Add products from vendor profiles.
          </p>
          <Link
            href="/browse"
            className="mt-6 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Browse members →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {cart.map((product) => {
              const fav = isFavorite(product.id);
              const qty = product.qty ?? 1;
              const lineTotal = (product.price ?? 0) * qty;
              return (
                <div key={product.id} className="card-soft flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="font-medium text-stone-900">{product.name}</div>
                    <div className="mt-1 text-sm text-stone-500">
                      by{" "}
                      <Link
                        href={`/members/${product.memberId}`}
                        className="text-indigo-700 hover:underline"
                      >
                        {product.memberName}
                      </Link>
                    </div>

                    <div className="mt-3 inline-flex items-center rounded-full border border-stone-200 bg-white">
                      <button
                        onClick={() => decrementCartItem(product.id)}
                        aria-label="Decrease quantity"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 disabled:opacity-40"
                        disabled={qty <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[2ch] px-2 text-center text-sm font-medium tabular-nums text-stone-900">
                        {qty}
                      </span>
                      <button
                        onClick={() => incrementCartItem(product.id)}
                        aria-label="Increase quantity"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {product.price != null && (
                      <div className="text-sm font-semibold text-emerald-700">
                        ${(lineTotal / 100).toFixed(2)}
                      </div>
                    )}
                    {qty > 1 && product.price != null && (
                      <div className="text-[11px] text-stone-400">
                        ${(product.price / 100).toFixed(2)} each
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(product)}
                        aria-label={fav ? "Remove from favorites" : "Save to favorites"}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:scale-110 hover:text-rose-500"
                      >
                        <Heart className={`h-4 w-4 ${fav ? "fill-rose-500 text-rose-500" : ""}`} />
                      </button>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        aria-label="Remove from cart"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-indigo-50 p-4">
            <div className="flex items-center justify-between text-stone-800">
              <span className="text-sm font-medium">
                Subtotal <span className="text-stone-500">· {totalItems} item{totalItems === 1 ? "" : "s"}</span>
              </span>
              <span className="text-xl font-semibold">
                {subtotal > 0 ? `$${(subtotal / 100).toFixed(2)}` : "—"}
              </span>
            </div>
            <button
              onClick={() => router.push("/checkout")}
              className="mt-4 w-full rounded-full bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Checkout →
            </button>
            {vendorIds.length > 0 && (
              <div className="mt-5 border-t border-indigo-100 pt-4">
                <div className="section-label">Quick links</div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {vendorIds.map((p) => (
                    <Link
                      key={p.memberId}
                      href={`/members/${p.memberId}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {p.memberName} →
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
