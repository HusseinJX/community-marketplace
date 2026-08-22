"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  GitCompare,
  Heart,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Truck,
  X,
} from "lucide-react";
import { useStore, type StoredProduct } from "@/lib/store";

// ─── Types & Data ──────────────────────────────────────────────────────────────

type Category = "Apparel" | "Headwear" | "Accessories" | "Home";
type Badge = "New" | "Bestseller" | "Low stock" | "Sale";

type Product = {
  id: string;
  name: string;
  price: number;
  compareAt?: number;
  category: Category;
  color: string;
  badge?: Badge;
  rating: number;
  reviews: number;
  colors: string[];
};

const products: Product[] = [
  { id: "tee-sun", name: "Sunbeam Tee", price: 38, category: "Apparel", color: "from-amber-200 to-orange-300", badge: "Bestseller", rating: 4.8, reviews: 214, colors: ["#f59e0b", "#0f172a", "#f5f5f4"] },
  { id: "hoodie-dusk", name: "Dusk Hoodie", price: 84, compareAt: 98, category: "Apparel", color: "from-indigo-300 to-violet-400", badge: "Sale", rating: 4.9, reviews: 132, colors: ["#6366f1", "#1e293b", "#a78bfa"] },
  { id: "cap-field", name: "Field Cap", price: 32, category: "Headwear", color: "from-emerald-200 to-teal-300", badge: "New", rating: 4.7, reviews: 58, colors: ["#10b981", "#0f172a", "#fef3c7"] },
  { id: "tote-grove", name: "Grove Tote", price: 24, category: "Accessories", color: "from-lime-200 to-emerald-300", rating: 4.6, reviews: 88, colors: ["#84cc16", "#f5f5f4"] },
  { id: "mug-ember", name: "Ember Mug", price: 18, category: "Home", color: "from-rose-200 to-orange-300", badge: "Low stock", rating: 4.5, reviews: 41, colors: ["#fb7185", "#fde68a"] },
  { id: "pin-set", name: "WhatsLocal Pin Set", price: 14, category: "Accessories", color: "from-sky-200 to-indigo-300", rating: 4.8, reviews: 26, colors: ["#0ea5e9", "#6366f1"] },
  { id: "crew-mesa", name: "Mesa Crewneck", price: 72, category: "Apparel", color: "from-stone-300 to-stone-500", badge: "New", rating: 4.7, reviews: 73, colors: ["#78716c", "#1c1917", "#e7e5e4"] },
  { id: "bottle-river", name: "River Bottle", price: 28, category: "Home", color: "from-cyan-200 to-blue-300", rating: 4.4, reviews: 19, colors: ["#06b6d4", "#0f172a"] },
  { id: "beanie-pine", name: "Pine Beanie", price: 26, category: "Headwear", color: "from-emerald-300 to-emerald-500", rating: 4.6, reviews: 47, colors: ["#059669", "#1c1917"] },
  { id: "scarf-haze", name: "Haze Scarf", price: 48, compareAt: 60, category: "Accessories", color: "from-fuchsia-200 to-pink-300", badge: "Sale", rating: 4.5, reviews: 33, colors: ["#e879f9", "#f5f5f4"] },
  { id: "tee-canyon", name: "Canyon Tee", price: 38, category: "Apparel", color: "from-orange-200 to-red-300", rating: 4.7, reviews: 96, colors: ["#f97316", "#1c1917", "#fef3c7"] },
  { id: "candle-grove", name: "Grove Candle", price: 22, category: "Home", color: "from-amber-100 to-yellow-200", badge: "New", rating: 4.9, reviews: 12, colors: ["#facc15"] },
];

// Map a shop product into the shared cart/favorites store shape (price in cents).
function toStored(p: Product): StoredProduct {
  return { id: p.id, name: p.name, memberId: "wl-shop", memberName: "WhatsLocal Shop", price: p.price * 100 };
}

const CATEGORIES: Category[] = ["Apparel", "Headwear", "Accessories", "Home"];

// Quick filters — a horizontal pill row above the grid. Orthogonal to the
// sidebar (category/price), so they compose with it rather than duplicate it.
const QUICK_FILTERS: { label: string; test: (p: Product) => boolean }[] = [
  { label: "All", test: () => true },
  { label: "New arrivals", test: (p) => p.badge === "New" },
  { label: "Bestsellers", test: (p) => p.badge === "Bestseller" },
  { label: "On sale", test: (p) => p.badge === "Sale" || p.compareAt != null },
  { label: "Under $30", test: (p) => p.price < 30 },
  { label: "Top rated", test: (p) => p.rating >= 4.8 },
];
const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "top-rated", label: "Top rated" },
];
const SIDEBAR_COLORS = ["#0f172a", "#f5f5f4", "#6366f1", "#10b981", "#f59e0b", "#fb7185", "#06b6d4", "#facc15"];

// ─── Badge component ───────────────────────────────────────────────────────────

function BadgePill({ badge }: { badge: Badge }) {
  const styles: Record<Badge, string> = {
    Sale: "bg-rose-600 text-white",
    New: "bg-stone-900 text-white",
    Bestseller: "bg-amber-400 text-stone-900",
    "Low stock": "bg-white text-stone-800 ring-1 ring-stone-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[badge]}`}>
      {badge}
    </span>
  );
}

// ─── Product Card (grid) ───────────────────────────────────────────────────────

function ProductCard({
  product,
  compared,
  onToggleCompare,
}: {
  product: Product;
  compared: boolean;
  onToggleCompare: () => void;
}) {
  const { toggleFavorite, isFavorite, addToCart, isInCart } = useStore();
  const faved = isFavorite(product.id);
  const inCart = isInCart(product.id);

  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition">
      {/* Square. The 4:5 portrait crop is a fashion-lookbook shape — it made
          each card tall enough that two of them filled a phone screen, and a
          local marketplace is mugs and candles as often as it is apparel. */}
      <div className={`relative aspect-square bg-gradient-to-br ${product.color}`}>
        {product.badge && (
          <div className="absolute left-3 top-3">
            <BadgePill badge={product.badge} />
          </div>
        )}
        <button
          onClick={() => toggleFavorite(toStored(product))}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-700 backdrop-blur transition hover:text-rose-600"
          aria-label="Favorite"
        >
          <Heart className={`h-4 w-4 ${faved ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
        <button
          onClick={onToggleCompare}
          className={`absolute right-3 top-12 inline-flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition ${
            compared ? "bg-indigo-600 text-white" : "bg-white/90 text-stone-700 hover:text-indigo-600"
          }`}
          aria-label="Compare"
          title="Compare"
        >
          <GitCompare className="h-4 w-4" />
        </button>
        <button
          onClick={() => addToCart(toStored(product))}
          className="absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white opacity-0 shadow transition group-hover:translate-y-0 group-hover:opacity-100"
        >
          {inCart ? "Added ✓" : "Quick add"}
        </button>
      </div>
      <div className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-stone-500">{product.category}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-medium text-stone-900">{product.name}</h3>
          <div className="flex items-baseline gap-1.5">
            {product.compareAt && (
              <span className="text-xs text-stone-400 line-through">${product.compareAt}</span>
            )}
            <span className="text-sm font-semibold text-stone-900">${product.price}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="font-medium text-stone-700">{product.rating.toFixed(1)}</span>
          <span>· {product.reviews} reviews</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {product.colors.map((c) => (
            <span
              key={c}
              className="h-3.5 w-3.5 rounded-full ring-1 ring-stone-200"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </article>
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
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [maxPrice, setMaxPrice] = useState(100);
  const [sort, setSort] = useState("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // the filter sidebar
  const [quickFilter, setQuickFilter] = useState("All");

  // Compare — pick up to 4 products, then open a side-by-side panel.
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 4 ? c : [...c, id]));
  const compareProducts = products.filter((p) => compare.includes(p.id));

  // Filter + sort
  const filtered = products
    .filter((p) => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (p.price > maxPrice) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      const quick = QUICK_FILTERS.find((q) => q.label === quickFilter);
      if (quick && !quick.test(p)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "top-rated") return b.rating - a.rating;
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
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-stone-400">
                <ShoppingBag className="h-10 w-10" />
                <p className="font-medium">No products match your filters</p>
              </div>
            ) : (
              // Same density as the Shops grid (LocalDirectory) — 2 / 3 / 4.
              // It was 2 up to xl, which made a product card roughly twice the
              // area of a shop card on a laptop, so switching tabs changed how
              // big the world looked rather than what was in it.
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    compared={compare.includes(p.id)}
                    onToggleCompare={() => toggleCompare(p.id)}
                  />
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
        maxPrice={maxPrice}
        onMaxPriceChange={setMaxPrice}
      />

      {/* Compare bar — floats once you pick products */}
      {compare.length > 0 && !showCompare && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white px-4 py-2.5 shadow-lg">
            <GitCompare className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-stone-800">{compare.length} to compare</span>
            <button
              onClick={() => setShowCompare(true)}
              disabled={compare.length < 2}
              className="rounded-full bg-stone-900 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              Compare
            </button>
            <button onClick={() => setCompare([])} className="text-xs text-stone-500 hover:text-stone-800">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Compare modal — side by side */}
      {showCompare && compareProducts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setShowCompare(false)}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <p className="text-sm font-semibold text-stone-900">Compare ({compareProducts.length})</p>
              <button onClick={() => setShowCompare(false)} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto p-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compareProducts.length}, minmax(140px, 1fr))` }}>
                {compareProducts.map((p) => (
                  <CompareColumn key={p.id} product={p} onRemove={() => toggleCompare(p.id)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
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
  maxPrice,
  onMaxPriceChange,
}: {
  open: boolean;
  onClose: () => void;
  selectedCategory: Category | "All";
  onSelectCategory: (c: Category | "All") => void;
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
              {(["All", ...CATEGORIES] as (Category | "All")[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => onSelectCategory(cat)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    selectedCategory === cat
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <p className="section-label mb-3">Price range</p>
            <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
              <span>$0</span>
              <span className="font-semibold text-stone-900">${maxPrice}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>

          {/* Availability */}
          <div>
            <p className="section-label mb-3">Availability</p>
            <div className="flex flex-col gap-2">
              {["In stock", "On sale", "New arrivals"].map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2.5 text-sm text-stone-600">
                  <input type="checkbox" className="rounded border-stone-300 accent-stone-900" />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <p className="section-label mb-3">Color</p>
            <div className="flex flex-wrap gap-2">
              {SIDEBAR_COLORS.map((c) => (
                <button
                  key={c}
                  className="h-7 w-7 rounded-full ring-2 ring-transparent ring-offset-2 transition hover:ring-stone-400"
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
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

// ─── Compare column ────────────────────────────────────────────────────────────

// One column of the compare panel.
function CompareColumn({ product, onRemove }: { product: Product; onRemove: () => void }) {
  const { addToCart, isInCart } = useStore();
  const rows: [string, React.ReactNode][] = [
    ["Price", <span key="p" className="font-semibold">${product.price}{product.compareAt ? <span className="ml-1 text-xs text-stone-400 line-through">${product.compareAt}</span> : null}</span>],
    ["Category", product.category],
    ["Rating", `${product.rating.toFixed(1)} (${product.reviews})`],
    ["Colors", <span key="c" className="flex gap-1">{product.colors.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full ring-1 ring-stone-200" style={{ background: c }} />)}</span>],
  ];
  return (
    <div className="min-w-0">
      <div className={`relative aspect-square rounded-xl bg-gradient-to-br ${product.color}`}>
        <button onClick={onRemove} className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-stone-600" aria-label="Remove">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-stone-900">{product.name}</p>
      <dl className="mt-2 space-y-1.5 text-[13px]">
        {rows.map(([label, val]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
            <dd className="text-stone-700">{val}</dd>
          </div>
        ))}
      </dl>
      <button
        onClick={() => addToCart(toStored(product))}
        className="mt-3 w-full rounded-lg bg-stone-900 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-stone-700"
      >
        {isInCart(product.id) ? "Added ✓" : "Add to cart"}
      </button>
    </div>
  );
}
