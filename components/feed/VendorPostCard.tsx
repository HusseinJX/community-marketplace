"use client";

import Link from "next/link";
import type { VendorPostFeedItem } from "@/lib/demo-feed";
import { authorColor, initials } from "@/lib/demo-feed";
import { ImageCarousel } from "@/components/ImageCarousel";
import { useStore } from "@/lib/store";

export function VendorPostCard({ item }: { item: VendorPostFeedItem }) {
  const { isInCart, addToCart, removeFromCart } = useStore();
  const color = authorColor(item.author.type);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-indigo-400" />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {initials(item.author.name)}
          </span>
          <Link
            href={`/members/${item.author.id}`}
            className="ml-1 text-sm font-medium text-indigo-600 hover:underline"
          >
            {item.author.name}
          </Link>
          <span>·</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600">
            {item.author.type}
          </span>
          <span>·</span>
          <span>{item.postedAt}</span>
        </div>

        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-stone-800">
          {item.body}
        </p>

        {item.images && item.images.length > 0 && (
          <div className="mt-4">
            <ImageCarousel images={item.images} alt="" aspect="video" rounded="rounded-xl" />
          </div>
        )}

        {item.product && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-stone-900">{item.product.name}</div>
              <div className="text-sm text-stone-500">${(item.product.price / 100).toFixed(2)}</div>
            </div>
            <button
              onClick={() =>
                isInCart(item.product!.id)
                  ? removeFromCart(item.product!.id)
                  : addToCart({
                      id: item.product!.id,
                      name: item.product!.name,
                      memberId: item.product!.memberId,
                      memberName: item.product!.memberName,
                      price: item.product!.price,
                    })
              }
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isInCart(item.product.id)
                  ? "bg-stone-900 text-white hover:bg-stone-800"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {isInCart(item.product.id) ? "✓ In cart" : "+ Cart"}
            </button>
          </div>
        )}

        <div className="mt-4">
          <Link
            href={`/members/${item.author.id}`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            View profile →
          </Link>
        </div>
      </div>
    </article>
  );
}
