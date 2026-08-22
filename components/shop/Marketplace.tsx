"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Heart,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Truck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useStore, type StoredProduct } from "@/lib/store";
import { useShopProducts } from "@/lib/data-hooks";
import type { ShopProduct } from "@/app/api/products/route";

// ─── Types & Data ──────────────────────────────────────────────────────────────

// The storefront is the products table. It used to be twelve objects in this
// file — Sunbeam Tee, Dusk Hoodie — with invented ratings ("4.8 · 214
// reviews"), gradient placeholders for photos, and `memberId: "wl-shop"`,
// which is not a vendor, so adding one to the cart built a basket checkout
// could never resolve. That shipped to production.
//
// What replaced it is narrower on purpose. A real product row has a name, a
// price, an image, a vendor and a kind. It has no rating, no review count, no
// compare-at price and no colourways, because nothing in this app records
// those — so the card no longer has them either. The only badge left is "New",
// which is created_at and therefore true.

/** Products are grouped by what they ARE, since nothing tags them by aisle. */
const KIND_LABELS: Record<string, string> = {
  good: "Goods",
  service: "Services",
  digital: "Digital",
  ticket: "Tickets",
};

/** The price slider's ceiling. At the top it means "no limit". */
const MAX_PRICE = 200;

/** Listed within this many days still reads as new. */
const NEW_DAYS = 30;

function isNew(p: ShopProduct): boolean {
  if (!p.createdAt) return false;
  const t = Date.parse(p.createdAt);
  return Number.isFinite(t) && Date.now() - t < NEW_DAYS * 86_400_000;
}

/** Prices are stored in cents. Everything user-facing is dollars. */
function dollars(cents: number): number {
  return cents / 100;
}

function priceLabel(cents: number): string {
  const d = dollars(cents);
  // Free is a real price here — a $0 row means free, not "price missing".
  if (d === 0) return "Free";
  return d % 1 === 0 ? `$${d}` : `$${d.toFixed(2)}`;
}

/**
 * The cart's id convention, and it is not cosmetic: checkout resolves a basket
 * by member_id + product NAME (see api/checkout/create-payment-intent). A card
 * that invented its own id would add something no server could price.
 */
function toStored(p: ShopProduct): StoredProduct {
  return {
    id: `${p.memberId}__${p.name}`,
    name: p.name,
    memberId: p.memberId,
    memberName: p.memberName,
    price: p.price,
  };
}

/** A stable placeholder for a product with no photo — never a fake photo. */
const GRADIENTS = [
  "from-amber-200 to-orange-300",
  "from-sky-200 to-blue-300",
  "from-violet-200 to-purple-300",
  "from-emerald-200 to-teal-300",
  "from-rose-200 to-pink-300",
  "from-lime-200 to-emerald-300",
];
function gradientFor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// Quick filters — a horizontal pill row above the grid. Every one of these
// answers from a real column. "Bestsellers", "On sale" and "Top rated" are
// gone with the data that never existed to support them.
const QUICK_FILTERS: { label: string; test: (p: ShopProduct) => boolean }[] = [
  { label: "All", test: () => true },
  { label: "New arrivals", test: isNew },
  { label: "Under $30", test: (p) => dollars(p.price) < 30 },
];
const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

// ─── Product card ─────────────────────────────────────────────────────────────

/**
 * A card is a LINK to the product's own page now. It used to be a div whose
 * only actions were favourite, compare and quick-add — so a shopper could put
 * something in a basket but never read what it was.
 *
 * The buttons on top of it stay buttons, and stop the click from reaching the
 * link. Favourite and add-to-cart are things you do to a product without
 * leaving the grid; that is the whole reason they are on the card.
 */
function ProductCard({ product }: { product: ShopProduct }) {
  const { toggleFavorite, isFavorite, addToCart, isInCart } = useStore();
  const stored = toStored(product);
  const faved = isFavorite(stored.id);
  const inCart = isInCart(stored.id);
  const fresh = isNew(product);

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:shadow-[var(--shadow-lift)]"
    >
      <div className={`relative aspect-square bg-gradient-to-br ${gradientFor(product.name)}`}>
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width:1280px) 260px, (min-width:768px) 33vw, 50vw"
            className="object-cover"
          />
        )}
        {fresh && (
          <div className="absolute left-3 top-3">
            <span className="inline-flex items-center rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
              New
            </span>
          </div>
        )}
        <button
          onClick={stop(() => toggleFavorite(stored))}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-700 backdrop-blur transition hover:text-rose-600"
          aria-label={faved ? "Remove from saved" : "Save"}
        >
          <Heart className={`h-4 w-4 ${faved ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
        <button
          onClick={stop(() => addToCart(stored))}
          className="absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white opacity-0 shadow transition group-hover:translate-y-0 group-hover:opacity-100"
        >
          {inCart ? "Added ✓" : "Quick add"}
        </button>
      </div>
      <div className="p-3">
        {/* The vendor, where the category used to be. It is the line that
            actually helps here: everything in this grid is somebody's, and
            whose it is decides where it ships from and who you're buying
            from. */}
        <p className="truncate text-[11px] uppercase tracking-wide text-stone-500">
          {product.memberName}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-medium text-stone-900">{product.name}</h3>
          <span className="shrink-0 text-sm font-semibold text-stone-900">
            {priceLabel(product.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * The marketplace: product grid, filters, sort, compare.
 *
 * Rendered in two places, which is why it is a component and not a page —
 * `/shop` (its own screen, with a back link) and the home Products tab
 * (`embedded`, inside the tab shell that already owns the header and nav).
 * One implementation, so the two can't drift apart.
 */
export function Marketplace({
  embedded = false,
  /**
   * A keyword from the page's own search box. Passing it takes over this
   * component's toolbar input — embedded in the home tab the header already
   * carries a search pill, and two boxes on one screen is one box too many
   * (see the "one search box per screen" convention). Standalone at /shop
   * nothing is passed and the toolbar input stays.
   */
  query,
}: {
  embedded?: boolean;
  query?: string;
}) {
  const [ownSearch, setOwnSearch] = useState("");
  const external = query != null;
  const search = external ? query : ownSearch;
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [sort, setSort] = useState("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // the filter sidebar
  const [quickFilter, setQuickFilter] = useState("All");

  const { products, loading } = useShopProducts();

  // The kinds actually present, in a fixed order. Offering "Digital" as a
  // filter when nothing digital is listed is a filter that can only ever
  // return nothing.
  const categories = ["good", "service", "digital", "ticket"].filter((k) =>
    products.some((p) => (p.kind || "good") === k),
  );

  // Filter + sort. Every clause reads a column that exists.
  const filtered = products
    .filter((p) => {
      if (selectedCategory !== "All" && (p.kind || "good") !== selectedCategory) return false;
      // The slider tops out at MAX_PRICE, and at the top it means "no limit"
      // rather than "nothing dearer than this" — otherwise a $400 item would
      // be unreachable with the filter untouched.
      if (maxPrice < MAX_PRICE && dollars(p.price) > maxPrice) return false;
      if (search && !`${p.name} ${p.memberName}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      const quick = QUICK_FILTERS.find((q) => q.label === quickFilter);
      if (quick && !quick.test(p)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "newest") return (b.createdAt || "").localeCompare(a.createdAt || "");
      return 0;
    });

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Featured";

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      <div
        className={
          // Embedded, this is a home tab and has to line up with the others:
          // Shops (LocalDirectory) is max-w-6xl px-4 md:px-8, and the grid was
          // max-w-7xl px-4 sm:px-6 lg:px-8 — a wider column on a different
          // edge, so switching tabs shifted the whole page sideways.
          embedded
            ? "mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8"
            : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        }
      >
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="text-lg font-bold text-stone-900">
              Shop all{" "}
              <span className="text-sm font-normal text-stone-400">({filtered.length} items)</span>
            </p>
          </div>

          {/* Search — only when this component owns the keyword. */}
          {!external && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search products…"
                value={ownSearch}
                onChange={(e) => setOwnSearch(e.target.value)}
                className="h-9 rounded-xl border border-stone-200 bg-white pl-9 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              onBlur={() => setTimeout(() => setShowSortMenu(false), 150)}
              className="flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300"
            >
              {sortLabel}
              <ChevronDown className="h-4 w-4 text-stone-400" />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onMouseDown={() => { setSort(o.value); setShowSortMenu(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-stone-50 ${
                      sort === o.value ? "font-semibold text-stone-900" : "text-stone-600"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters toggle — at EVERY width now. It used to be `lg:hidden`,
              because on desktop the sidebar was permanently mounted; that made
              it a filter column you could never put away on the screens where
              the grid most wants the room. One button, one sidebar, one state. */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300"
          >
            <SlidersHorizontal className="h-4 w-4 text-stone-400" />
            {showFilters ? "Hide filters" : "Filters"}
          </button>

        </div>

        {/* Quick filters — one horizontal scroll row of pills */}
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_FILTERS.map((q) => (
            <button
              key={q.label}
              onClick={() => setQuickFilter(q.label)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                quickFilter === q.label
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* The filter SIDEBAR slides in over the page from the left, opened by
            the Filters button above — same slide-over the business search uses
            (components/FilterSidebar). It is rendered at the bottom of this
            component, outside the page container, because a fixed-position
            panel has to escape it. */}

        {/* Product area — full width; the filters float above the page rather
            than taking a column out of it. */}
        <div>
          <div className="min-w-0">
            {loading ? (
              // Skeletons in the real grid, so the page doesn't jump when the
              // catalogue lands.
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-stone-200 bg-white">
                    <div className="aspect-square bg-stone-100" />
                    <div className="space-y-2 p-3">
                      <div className="h-2.5 w-1/2 rounded bg-stone-100" />
                      <div className="h-3.5 w-3/4 rounded bg-stone-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              // Two different nothings, and saying the wrong one is its own
              // bug: "no products match your filters" in front of someone who
              // has set no filters blames them for an empty shop.
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-stone-400">
                <ShoppingBag className="h-10 w-10" />
                {products.length === 0 ? (
                  <>
                    <p className="font-medium text-stone-600">No products listed yet</p>
                    <p className="max-w-xs text-sm">
                      When local businesses list what they sell, it shows up here.
                    </p>
                    <Link
                      href="/join"
                      className="mt-1 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Sell something local
                    </Link>
                  </>
                ) : (
                  <p className="font-medium">No products match your filters</p>
                )}
              </div>
            ) : (
              // Same density as the Shops grid (LocalDirectory) — 2 / 3 / 4.
              // It was 2 up to xl, which made a product card roughly twice the
              // area of a shop card on a laptop, so switching tabs changed how
              // big the world looked rather than what was in it.
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="mt-10 flex items-center justify-center gap-1">
                {[1, 2, 3].map((page) => (
                  <button
                    key={page}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold transition ${
                      page === 1
                        ? "bg-stone-900 text-white"
                        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-600 transition hover:bg-stone-100 hover:text-stone-900">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Truck className="h-5 w-5 text-stone-600" />,
              title: "Free shipping",
              body: "On all orders over $75. Ships within 2–3 business days.",
            },
            {
              icon: <Star className="h-5 w-5 text-stone-600" />,
              title: "Made in small batches",
              body: "Every item is crafted with care by independent makers.",
            },
            {
              icon: <ArrowLeft className="h-5 w-5 text-stone-600" />,
              title: "Easy returns",
              body: "30-day hassle-free returns. No questions asked.",
            },
          ].map((t) => (
            <div key={t.title} className="card-soft flex items-start gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                {t.icon}
              </div>
              <div>
                <p className="font-semibold text-stone-900">{t.title}</p>
                <p className="mt-0.5 text-sm text-stone-500">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The filter sidebar itself. Outside the page container on purpose —
          it is fixed-position and portalled to <body>. */}
      <ProductFilterSidebar
        open={showFilters}
        onClose={() => setShowFilters(false)}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categories={categories}
        maxPrice={maxPrice}
        onMaxPriceChange={setMaxPrice}
      />


    </div>
  );
}


// ─── Filter sidebar ────────────────────────────────────────────────────────────

/**
 * The product filters, as a slide-in sidebar over the page.
 *
 * Same shape and same reasoning as components/FilterSidebar (the business
 * facets panel on home): overlay + fixed left panel, rendered through a PORTAL
 * to <body>. The portal is not optional — `position: fixed` is only relative to
 * the viewport while no ancestor carries a `filter`, `backdrop-filter`,
 * `transform` or `will-change`, and this opens from a toolbar that can sit
 * under exactly such a header. Portalled, no styling decision further up the
 * tree can clip it.
 *
 * The filter CONTROLS inside are unchanged from when they were a static column
 * — category, price range, availability, colour.
 */
function ProductFilterSidebar({
  open,
  onClose,
  selectedCategory,
  onSelectCategory,
  categories,
  maxPrice,
  onMaxPriceChange,
}: {
  open: boolean;
  onClose: () => void;
  selectedCategory: string;
  onSelectCategory: (c: string) => void;
  categories: string[];
  maxPrice: number;
  onMaxPriceChange: (n: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // The page behind must not scroll while the panel is open — on a phone the
  // drag lands on the page, not the panel, and you come back to a different
  // scroll position than you left.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Portals need a DOM that exists — mount client-side only, or SSR throws.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-stone-900/40 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel — full-height left sidebar. z above the bottom nav (z-40), which
          would otherwise sit on top of the panel's own footer button. */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Product filters"
        aria-hidden={!open}
      >
        <div
          className="flex items-center justify-between border-b border-stone-100 px-5 pb-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <h2 className="text-base font-semibold text-stone-900">Filters</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Category */}
          <div>
            <p className="section-label mb-3">Category</p>
            <div className="flex flex-col gap-1">
              {["All", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    selectedCategory === cat
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  {cat === "All" ? "All" : KIND_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <p className="section-label mb-3">Price range</p>
            <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
              <span>$0</span>
              <span className="font-semibold text-stone-900">
                {maxPrice >= MAX_PRICE ? "Any" : `$${maxPrice}`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_PRICE}
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>

          {/* What used to be here: an "Availability" checkbox group (In stock /
              On sale / New arrivals) and a row of colour swatches. Neither was
              wired to anything — no state, no handler — and none of the three
              things they filtered on exists as data. A control that cannot
              change what you see is worse than no control: it reads as a
              filter you have already applied. */}
        </div>

        <div
          className="border-t border-stone-100 px-5 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Apply filters
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
