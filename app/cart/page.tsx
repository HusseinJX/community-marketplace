'use client'

import Link from 'next/link'
import { useStore } from '@/lib/store'

export default function CartPage() {
  const { cart, removeFromCart, clearCart, toggleFavorite, isFavorite } = useStore()

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm font-medium text-indigo-700 hover:underline">
        &larr; Back to browse
      </Link>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">Cart</h1>
          {cart.length > 0 && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
              {cart.length}
            </span>
          )}
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-sm text-stone-500 hover:text-red-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🛍️</span>
          <p className="text-base text-stone-500">
            Your cart is empty. Add products from vendor profiles.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Browse members
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {cart.map((product) => (
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
                  onClick={() => toggleFavorite(product)}
                  className="rounded-full p-1.5 text-sm hover:bg-stone-100 transition-colors"
                  title={isFavorite(product.id) ? 'Remove from favorites' : 'Save to favorites'}
                >
                  {isFavorite(product.id) ? '❤️' : '🤍'}
                </button>
                <button
                  onClick={() => removeFromCart(product.id)}
                  className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
            <h2 className="text-base font-semibold text-indigo-900">Ready to buy?</h2>
            <p className="mt-1 text-sm text-indigo-700">
              Visit each vendor&apos;s profile to find their shop link or contact them directly.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Array.from(new Map(cart.map(p => [p.memberId, p])).values()).map((product) => (
                <Link
                  key={product.memberId}
                  href={`/members/${product.memberId}`}
                  className="rounded-full bg-white border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  {product.memberName} &rarr;
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
