'use client'

import Link from 'next/link'
import { useStore } from '@/lib/store'

export default function FavoritesPage() {
  const { favorites, toggleFavorite, addToCart, removeFromCart, isInCart } = useStore()

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm font-medium text-indigo-700 hover:underline">
        &larr; Back to browse
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-stone-900">Saved products</h1>
        {favorites.length > 0 && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
            {favorites.length}
          </span>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🤍</span>
          <p className="text-base text-stone-500">
            No saved products yet. Visit a vendor profile and heart the products you love.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Browse members
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {favorites.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-base font-semibold text-stone-900">{product.name}</p>
                <Link
                  href={`/members/${product.memberId}`}
                  className="text-sm text-indigo-700 hover:underline"
                >
                  by {product.memberName}
                </Link>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => isInCart(product.id) ? removeFromCart(product.id) : addToCart(product)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isInCart(product.id)
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'border border-stone-200 bg-white text-stone-700 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  {isInCart(product.id) ? 'In cart' : '+ Cart'}
                </button>
                <button
                  onClick={() => toggleFavorite(product)}
                  className="rounded-full p-1.5 text-sm hover:bg-stone-100 transition-colors"
                  title="Remove from favorites"
                >
                  ❤️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
