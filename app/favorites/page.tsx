'use client'

import Link from 'next/link'
import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react'
import { useStore } from '@/lib/store'

export default function FavoritesPage() {
  const { favorites, toggleFavorite, addToCart, removeFromCart, isInCart } = useStore()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

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
          {favorites.map((product) => {
            const inC = isInCart(product.id)
            return (
              <div key={product.id} className="card-soft flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-medium text-stone-900">{product.name}</div>
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
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => inC ? removeFromCart(product.id) : addToCart(product)}
                    className={
                      'rounded-full px-3.5 py-1.5 text-xs font-medium transition ' +
                      (inC
                        ? 'bg-indigo-600 text-white'
                        : 'border border-stone-200 bg-white text-stone-700 hover:border-indigo-300 hover:text-indigo-700')
                    }
                  >
                    {inC ? 'In cart' : '+ Cart'}
                  </button>
                  <button
                    onClick={() => toggleFavorite(product)}
                    aria-label="Remove from favorites"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-50"
                  >
                    <Heart className="h-4 w-4 fill-rose-500" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
