"use client";

import { useState } from "react";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { VariantPicker, type PickableVariant } from "@/components/shop/VariantPicker";

/**
 * The buying half of a product page: the photographs on the left, the choice
 * and the price on the right, sharing ONE piece of state.
 *
 * They were separate before — the picker owned the selection and the page
 * server-rendered the cover — so choosing a colour changed the price and left
 * the picture alone. On a print-on-demand catalogue where "Black / L" and
 * "Navy / L" are different photographs, that is the storefront agreeing to sell
 * you something other than what you are looking at.
 *
 * `children` is the server-rendered prose (seller, title, description) that
 * sits above the picker. It is passed through rather than reimplemented here so
 * the page stays a server component and none of that text ships as JS.
 */
export function ProductBuy({
  variants,
  currency,
  memberId,
  memberName,
  alt,
  children,
}: {
  variants: PickableVariant[];
  currency: string;
  memberId: string;
  memberName: string;
  alt: string;
  children: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-10">
      <ProductGallery
        images={selected?.images?.length ? selected.images : []}
        alt={selected ? `${alt} — ${selected.label}`.replace(/ — $/, "") : alt}
      />

      <div className="min-w-0">
        {children}
        <div className="mt-6">
          <VariantPicker
            variants={variants}
            currency={currency}
            memberId={memberId}
            memberName={memberName}
            selectedId={selected?.id ?? ""}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
