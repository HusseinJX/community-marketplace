"use client";

import { useMemo, useState } from "react";
import { variantParts } from "@/lib/product-variants";
import { AddToCart } from "@/components/shop/AddToCart";

export interface PickableVariant {
  id: string;
  /** "Black / L". Empty when the product has no variants. */
  label: string;
  price: number;
  /** The row's own name, which is what the cart and checkout resolve by. */
  name: string;
}

function priceLabel(cents: number, currency = "usd"): string {
  if (cents === 0) return "Free";
  const d = cents / 100;
  const s = d % 1 === 0 ? `${d}` : d.toFixed(2);
  return currency.toLowerCase() === "usd" ? `$${s}` : `${s} ${currency.toUpperCase()}`;
}

/**
 * Pick a size and colour on the product page, rather than meeting nine
 * near-identical listings in the grid.
 *
 * The axes are derived from the labels by POSITION, never by reading the
 * values: Printify writes "Black / L" on one product and "One size / Army" on
 * another, so anything that decided "the second part is the size" would be
 * wrong on half the catalogue. Unlabelled chip rows say what the values are
 * without claiming to know what they mean.
 *
 * If the labels don't agree on a shape — different numbers of parts across
 * variants — it falls back to one chip per whole label, which is uglier and
 * always correct.
 */
export function VariantPicker({
  variants,
  currency,
  memberId,
  memberName,
}: {
  variants: PickableVariant[];
  currency: string;
  memberId: string;
  memberName: string;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  const axes = useMemo(() => {
    if (variants.length < 2) return null;
    const parts = variants.map((v) => variantParts(v.label));
    const width = parts[0]?.length ?? 0;
    // One axis is just a flat list; ragged labels can't be crossed safely.
    if (width < 2 || !parts.every((p) => p.length === width)) return null;
    return Array.from({ length: width }, (_, i) => {
      const seen: string[] = [];
      for (const p of parts) if (!seen.includes(p[i])) seen.push(p[i]);
      return seen;
    });
  }, [variants]);

  const selectedParts = variantParts(selected?.label ?? "");

  /** Move one axis, keeping the others where they are if that combination exists. */
  function choose(axis: number, value: string) {
    const want = [...selectedParts];
    want[axis] = value;
    const exact = variants.find(
      (v) => variantParts(v.label).join(" / ") === want.join(" / "),
    );
    // Not every combination is stocked — a colour may exist only in some
    // sizes. Falling back to the cheapest match on the axis they just touched
    // keeps the click meaningful instead of silently doing nothing.
    const fallback = variants
      .filter((v) => variantParts(v.label)[axis] === value)
      .sort((a, b) => a.price - b.price)[0];
    const next = exact ?? fallback;
    if (next) setSelectedId(next.id);
  }

  if (!selected) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-stone-900">
          {priceLabel(selected.price, currency)}
        </span>
        {variants.length > 1 && selected.label && (
          <span className="text-sm text-stone-500">{selected.label}</span>
        )}
      </div>

      {axes
        ? axes.map((values, i) =>
            // An axis with one value is not a choice — every variant of this
            // shirt is black, so a lone "Black" chip is a button that does
            // nothing. The value still shows next to the price above.
            values.length < 2 ? null : (
            <div key={i} className="flex flex-wrap gap-2">
              {values.map((value) => {
                const on = selectedParts[i] === value;
                return (
                  <button
                    key={value}
                    onClick={() => choose(i, value)}
                    aria-pressed={on}
                    className={
                      "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition " +
                      (on
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-400")
                    }
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            ),
          )
        : variants.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  aria-pressed={v.id === selected.id}
                  className={
                    "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition " +
                    (v.id === selected.id
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-400")
                  }
                >
                  {v.label || "Standard"}
                </button>
              ))}
            </div>
          )}

      {/* The cart carries the CHOSEN variant's own row — its id is built from
          that row's name, which is what create-payment-intent resolves and what
          printifyLinesFor matches to a production order. Choosing a size is
          therefore choosing what gets printed, not a label on top of one. */}
      <AddToCart
        key={selected.id}
        id={`${memberId}__${selected.name}`}
        name={selected.name}
        memberId={memberId}
        memberName={memberName}
        price={selected.price}
      />
    </div>
  );
}
