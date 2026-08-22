"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * The one interactive part of the product page.
 *
 * The id is built by the SERVER and passed in, in the shape checkout resolves
 * (`${memberId}__${name}` — see api/checkout/create-payment-intent, which
 * looks a basket up by member and product name). A client that composed its
 * own id could add something no server can price.
 */
export function AddToCart({
  id,
  name,
  memberId,
  memberName,
  price,
}: {
  id: string;
  name: string;
  memberId: string;
  memberName: string;
  price: number;
}) {
  const { addToCart, isInCart } = useStore();
  const inCart = isInCart(id);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => addToCart({ id, name, memberId, memberName, price })}
        className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
      >
        {inCart ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
        {inCart ? "In your cart" : "Add to cart"}
      </button>
      {inCart && (
        <a href="/cart" className="text-sm font-medium text-stone-600 underline hover:text-stone-900">
          Go to cart
        </a>
      )}
    </div>
  );
}
