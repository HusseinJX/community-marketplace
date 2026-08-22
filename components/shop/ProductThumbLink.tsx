"use client";

import Link from "next/link";
import Image from "next/image";
import type { StoredProduct } from "@/lib/store";

/**
 * A saved or basketed line's way back to the thing itself.
 *
 * Shared by the cart and the saved list because they are the same line: a
 * picture, a name, and a link to the page that sells it. Both lists are built
 * from `StoredProduct`, whose `image` and `productId` are OPTIONAL — a basket
 * saved before products had pages has neither, and a line that isn't a link is
 * better than one that 404s. So this degrades to plain text and an empty tile
 * rather than guessing a URL.
 */
export function ProductLink({
  product,
  className,
  children,
}: {
  product: StoredProduct;
  className?: string;
  children: React.ReactNode;
}) {
  if (!product.productId) return <div className={className}>{children}</div>;
  return (
    <Link href={`/products/${product.productId}`} className={className}>
      {children}
    </Link>
  );
}

export function ProductThumb({ product }: { product: StoredProduct }) {
  return (
    <ProductLink
      product={product}
      className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100"
    >
      {product.image && (
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="64px"
          // Mockups are shot on white — contain, so the print isn't cropped.
          className="object-contain"
        />
      )}
    </ProductLink>
  );
}
