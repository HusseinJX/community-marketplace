/**
 * One listing, many variants — without a variants table.
 *
 * Printify prices and ships a VARIANT (a size, a colour), so the importer
 * writes one `products` row per enabled variant: "xen0 Tee — Black / L". That
 * is right for the money — the cart, the postage quote and the production
 * order all address the same specific thing — and wrong for the shopper, who
 * met a grid of nine identical shirts.
 *
 * So the rows stay as they are and the READING side groups them. A group is
 * everything sharing a `printify_product_id`; a hand-made product is a group
 * of one. Nothing about checkout changes: the buyer picks a variant, the cart
 * holds that variant's own row, and `create-payment-intent` resolves it by
 * member + name exactly as before.
 *
 * The alternative — a variants column, or a variants table — would have meant
 * touching the one part of this codebase where a mistake charges the wrong
 * money.
 */

export interface VariantRow {
  id: string
  name: string
  price: number
  image: string | null
  printifyProductId?: string | null
}

/** "xen0 Tee — Black / L" → "xen0 Tee" */
export function baseName(name: string): string {
  const i = name.indexOf(' — ')
  return i === -1 ? name : name.slice(0, i)
}

/** "xen0 Tee — Black / L" → "Black / L" (empty for a product with no variant) */
export function variantLabel(name: string): string {
  const i = name.indexOf(' — ')
  return i === -1 ? '' : name.slice(i + 3)
}

/**
 * Split a variant label into its choices: "Black / L" → ["Black", "L"].
 *
 * Printify's own separator, and its order is not guaranteed to be
 * colour-then-size — "One size / Army" puts the size first. So the axes are
 * NAMED BY POSITION, never guessed at by content: a picker that labelled
 * "Army" as a size because it appeared second would be wrong on half the
 * catalogue.
 */
export function variantParts(label: string): string[] {
  return label.split(' / ').map((p) => p.trim()).filter(Boolean)
}

/** The key everything in a group shares. Singletons key on their own id. */
export function groupKey(row: VariantRow): string {
  return row.printifyProductId || row.id
}

export interface Grouped<T extends VariantRow> {
  /** The row shown on the card and opened by default: the cheapest. */
  lead: T
  name: string
  variants: T[]
  fromPrice: number
  toPrice: number
}

/**
 * Group rows into listings, preserving the order the rows arrived in — the
 * catalogue is already sorted (newest first) and regrouping must not reshuffle
 * it.
 */
export function groupVariants<T extends VariantRow>(rows: T[]): Grouped<T>[] {
  const byKey = new Map<string, T[]>()
  for (const row of rows) {
    const k = groupKey(row)
    const list = byKey.get(k)
    if (list) list.push(row)
    else byKey.set(k, [row])
  }

  return Array.from(byKey.values()).map((variants) => {
    // Cheapest leads, because "from $30" has to be true of the thing you are
    // looking at. Sorted copy — the caller's array order is the grid's order.
    const sorted = [...variants].sort((a, b) => a.price - b.price)
    const lead = sorted[0]
    return {
      lead,
      name: baseName(lead.name),
      // Variants keep price order too, so a size list reads small → large in
      // the common case where price rises with size.
      variants: sorted,
      fromPrice: sorted[0].price,
      toPrice: sorted[sorted.length - 1].price,
    }
  })
}
