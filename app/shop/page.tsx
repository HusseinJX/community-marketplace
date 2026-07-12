"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Heart,
  LayoutGrid,
  List,
  Search,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";

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

const CATEGORIES: Category[] = ["Apparel", "Headwear", "Accessories", "Home"];
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

function ProductCard({ product }: { product: Product }) {
  const [faved, setFaved] = useState(false);

  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition">
      <div className={`relative aspect-[4/5] bg-gradient-to-br ${product.color}`}>
        {product.badge && (
          <div className="absolute left-3 top-3">
            <BadgePill badge={product.badge} />
          </div>
        )}
        <button
          onClick={() => setFaved((f) => !f)}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-700 backdrop-blur transition hover:text-rose-600"
          aria-label="Favorite"
        >
          <Heart className={`h-4 w-4 ${faved ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
        <button className="absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-stone-900 px-3.5 py-2 text-[13px] font-medium text-white opacity-0 shadow transition group-hover:translate-y-0 group-hover:opacity-100">
          Quick add
        </button>
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-stone-500">{product.category}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="text-base font-medium text-stone-900">{product.name}</h3>
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

// ─── Product Row (list) ────────────────────────────────────────────────────────

function ProductRow({ product }: { product: Product }) {
  const [faved, setFaved] = useState(false);

  return (
    <div className="card-soft card-hover flex items-center gap-4 p-4">
      {/* Swatch thumbnail */}
      <div className={`h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br ${product.color}`} />
      {/* Info */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-stone-900">{product.name}</p>
          {product.badge && <BadgePill badge={product.badge} />}
        </div>
        <p className="text-xs text-stone-500">{product.category}</p>
        <div className="flex items-center gap-1 text-xs text-stone-500">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {product.rating} · {product.reviews} reviews
        </div>
        <div className="flex gap-1 pt-1">
          {product.colors.map((c) => (
            <span
              key={c}
              className="h-3.5 w-3.5 rounded-full ring-1 ring-stone-200"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {/* Price + actions */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-stone-900">${product.price}</span>
          {product.compareAt && (
            <span className="text-sm text-stone-400 line-through">${product.compareAt}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFaved((f) => !f)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:text-rose-500"
            aria-label="Favorite"
          >
            <Heart className={`h-4 w-4 ${faved ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
          <button className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-stone-700">
            <ShoppingBag className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [maxPrice, setMaxPrice] = useState(100);
  const [sort, setSort] = useState("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Filter + sort
  const filtered = products
    .filter((p) => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (p.price > maxPrice) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "top-rated") return b.rating - a.rating;
      return 0;
    });

  const heroProducts = products.slice(0, 6);
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Featured";

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement bar */}
      <div className="flex items-center justify-center gap-3 bg-stone-900 py-2.5 text-sm font-medium text-stone-100">
        <Truck className="h-4 w-4 shrink-0 text-stone-400" />
        <span>Free shipping on orders over $75 · New drop available now</span>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to WhatsLocal AI
        </Link>

        {/* Hero section */}
        <section className="mb-10 overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-900 via-stone-800 to-indigo-900 p-8 text-white md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                <ShoppingBag className="h-3.5 w-3.5" /> Xen Merch · Spring drop
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
                <span className="underline decoration-pink-400 decoration-2 underline-offset-4">We ar</span>
                <span className="text-pink-300/80">e</span>
                <span> WhatsLocal.</span>
              </h1>
              <p className="mt-3 max-w-md text-stone-300">
                Limited-run apparel and goods made with the artists, makers, and communities we work with every day.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
                  Shop the drop <ArrowRight className="h-4 w-4" />
                </button>
                <button className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20">
                  Lookbook
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {heroProducts.map((p, i) => (
                <div
                  key={p.id}
                  className={`aspect-square rounded-2xl bg-gradient-to-br ${p.color} ${
                    i === 1 || i === 4 ? "translate-y-4" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="text-lg font-bold text-stone-900">
              Shop all{" "}
              <span className="text-sm font-normal text-stone-400">({filtered.length} items)</span>
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl border border-stone-200 bg-white pl-9 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

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

          {/* View toggle */}
          <div className="flex rounded-xl border border-stone-200 bg-white p-0.5">
            <button
              onClick={() => setView("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                view === "grid" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                view === "list" ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* Sidebar filters */}
          <aside className="hidden w-60 shrink-0 flex-col gap-6 lg:flex">
            {/* Category */}
            <div className="card-soft p-4">
              <p className="section-label mb-3">Category</p>
              <div className="flex flex-col gap-1">
                {(["All", ...CATEGORIES] as (Category | "All")[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
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
            <div className="card-soft p-4">
              <p className="section-label mb-3">Price range</p>
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>$0</span>
                <span className="font-semibold text-stone-900">${maxPrice}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-stone-900"
              />
            </div>

            {/* Availability */}
            <div className="card-soft p-4">
              <p className="section-label mb-3">Availability</p>
              <div className="flex flex-col gap-2">
                {["In stock", "On sale", "New arrivals"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2.5 text-sm text-stone-600 cursor-pointer">
                    <input type="checkbox" className="rounded border-stone-300 accent-stone-900" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* Color swatches */}
            <div className="card-soft p-4">
              <p className="section-label mb-3">Color</p>
              <div className="flex flex-wrap gap-2">
                {SIDEBAR_COLORS.map((c) => (
                  <button
                    key={c}
                    className="h-7 w-7 rounded-full ring-2 ring-offset-2 ring-transparent transition hover:ring-stone-400"
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </aside>

          {/* Product area */}
          <div className="min-w-0 flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-stone-400">
                <ShoppingBag className="h-10 w-10" />
                <p className="font-medium">No products match your filters</p>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((p) => (
                  <ProductRow key={p.id} product={p} />
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
    </div>
  );
}
