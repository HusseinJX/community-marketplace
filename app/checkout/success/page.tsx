import Link from 'next/link'

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-10">
        <div className="mb-4 text-5xl">&#10003;</div>
        <h1 className="text-2xl font-semibold text-green-900">Payment successful!</h1>
        <p className="mt-3 text-base text-green-700">
          Your order has been placed. The vendor will be in touch with next steps.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Browse more members
          </Link>
          <Link
            href="/cart"
            className="rounded-full border border-stone-300 px-6 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
          >
            View cart
          </Link>
        </div>
      </div>
    </div>
  )
}
