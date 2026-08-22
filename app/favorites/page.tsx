'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ProductLink, ProductThumb } from '@/components/shop/ProductThumbLink'

export default function FavoritesPage() {
  // No add-to-cart here. A saved list is a list of things you meant to look at
  // again, and looking again is what the product page is for — with the size,
  // the colour and the description that a one-line row can't carry.
  const { favorites, toggleFavorite } = useStore()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
      <h1 className="mt-6 flex items-center gap-3 text-3xl font-semibold tracking-tight text-stone-900">
        Saved products
        {favorites.length > 0 && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
            {favorites.length}
          </span>
        )}
      </h1>

      {favorites.length === 0 ? (
        <div className="card-soft mt-10 flex flex-col items-center justify-center px-6 py-20 text-center">
          <Heart className="h-10 w-10 text-stone-300" />
          <p className="mt-4 text-base text-stone-700">
            No saved products yet. Visit a vendor profile and heart the products you love.
          </p>
          <Link
            href="/"
            className="mt-6 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Browse members →
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {favorites.map((product) => (
            <div key={product.id} className="card-soft flex items-start justify-between gap-4 p-4">
              {/* The picture first, then the name, both the same link back. */}
              <div className="flex min-w-0 items-start gap-3">
                <ProductThumb product={product} />
                <div className="min-w-0">
                  <ProductLink product={product} className="font-medium text-stone-900 hover:underline">
                    {product.name}
                  </ProductLink>
                  <div className="mt-1 text-sm text-stone-500">
                    by{' '}
                    <Link
                      href={`/members/${product.memberId}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {product.memberName}
                    </Link>
                  </div>
                  {product.price != null && (
                    <div className="mt-2 text-sm font-semibold text-emerald-700">
                      ${(product.price / 100).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleFavorite(product)}
                aria-label="Remove from favorites"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-50"
              >
                <Heart className="h-4 w-4 fill-rose-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
