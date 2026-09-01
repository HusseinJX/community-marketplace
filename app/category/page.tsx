import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Dumbbell,
  GlassWater,
  Heart,
  MapPin,
  Music,
  Paintbrush,
  Scissors,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { SITE_NAME } from "@/lib/seo";
import { CATEGORIES, slugify } from "@/lib/landing";
import { TAXONOMY } from "@/lib/taxonomy";

// Directory-backed page: regenerate daily, not per crawler hit.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Browse local categories",
  description: `Explore local bars, sports, barbers, food, shops, artists, and community events by category on ${SITE_NAME}.`,
  alternates: { canonical: "/category" },
};

type CategoryCard = {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  eyebrow: string;
  tags: string[];
  tone: string;
};

type CategoryGroup = {
  title: string;
  cards: CategoryCard[];
};

const categoryHref = (name: string) => `/category/${slugify(name)}`;
const searchHref = (query: string) => `/explore?q=${encodeURIComponent(query)}`;

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    title: "Food & Nightlife",
    cards: [
      {
        title: "Bars",
        href: searchHref("bar cocktails nightlife"),
        description: "Cocktail rooms, taprooms, lounges, and late-night neighborhood spots.",
        icon: GlassWater,
        eyebrow: "Go out",
        tags: ["Cocktails", "Beer", "Nightlife"],
        tone: "bg-coral-50 text-coral-700 ring-coral-100",
      },
      {
        title: "Restaurants",
        href: categoryHref("Food & Beverage"),
        description: "Restaurants, cafes, bakeries, pop-ups, food trucks, and caterers.",
        icon: Utensils,
        eyebrow: "Eat local",
        tags: ["Cafes", "Bakeries", "Food trucks"],
        tone: "bg-orange-100 text-orange-700 ring-orange-100",
      },
      {
        title: "Live Music",
        href: searchHref("live music dj band"),
        description: "Venues, DJs, bands, singers, and performers for nights out.",
        icon: Music,
        eyebrow: "Sounds",
        tags: ["DJs", "Bands", "Shows"],
        tone: "bg-violet-100 text-violet-700 ring-violet-100",
      },
    ],
  },
  {
    title: "Sports & Wellness",
    cards: [
      {
        title: "Sports",
        href: searchHref("sports games watch party"),
        description: "Watch parties, local leagues, clubs, fan gatherings, and game-day venues.",
        icon: Dumbbell,
        eyebrow: "Game day",
        tags: ["Watch parties", "Leagues", "Clubs"],
        tone: "bg-emerald-100 text-emerald-700 ring-emerald-100",
      },
      {
        title: "Gyms & Studios",
        href: categoryHref("Health & Wellness"),
        description: "Gyms, yoga studios, trainers, spas, massage, and recovery businesses.",
        icon: Sparkles,
        eyebrow: "Wellness",
        tags: ["Gyms", "Yoga", "Massage"],
        tone: "bg-blue-100 text-blue-700 ring-blue-100",
      },
      {
        title: "Community Events",
        href: categoryHref("Events"),
        description: "Markets, festivals, concerts, art shows, food events, and sports meetups.",
        icon: CalendarDays,
        eyebrow: "Gather",
        tags: ["Markets", "Concerts", "Festivals"],
        tone: "bg-pink-100 text-pink-700 ring-pink-100",
      },
    ],
  },
  {
    title: "Style, Services & Culture",
    cards: [
      {
        title: "Barbers",
        href: searchHref("barber haircut grooming"),
        description: "Barbers, salons, grooming services, stylists, and beauty shops.",
        icon: Scissors,
        eyebrow: "Grooming",
        tags: ["Haircuts", "Grooming", "Salons"],
        tone: "bg-stone-100 text-stone-800 ring-stone-200",
      },
      {
        title: "Shops",
        href: categoryHref("Retail"),
        description: "Clothing, books, flowers, gifts, home goods, beauty, and accessories.",
        icon: ShoppingBag,
        eyebrow: "Retail",
        tags: ["Gifts", "Fashion", "Home goods"],
        tone: "bg-coral-50 text-coral-700 ring-coral-100",
      },
      {
        title: "Artists & Makers",
        href: categoryHref("Arts & Crafts"),
        description: "Galleries, handmade goods, jewelry, ceramics, murals, and creative work.",
        icon: Paintbrush,
        eyebrow: "Creative",
        tags: ["Galleries", "Jewelry", "Murals"],
        tone: "bg-violet-100 text-violet-700 ring-violet-100",
      },
      {
        title: "Photography",
        href: searchHref("photographer photography camera"),
        description: "Photographers, videographers, content creators, and event media teams.",
        icon: Camera,
        eyebrow: "Media",
        tags: ["Portraits", "Events", "Video"],
        tone: "bg-blue-100 text-blue-700 ring-blue-100",
      },
    ],
  },
];

const TAXONOMY_GROUPS = [
  { label: "Businesses", type: "vendor" },
  { label: "Artists", type: "artist" },
  { label: "Organizers", type: "organizer" },
];

export default function CategoryIndexPage() {
  const featuredCards = CATEGORY_GROUPS.flatMap((group) => group.cards);

  return (
    <div className="bg-[#f7f6f2]">
      <section className="border-b border-stone-200 bg-[radial-gradient(circle_at_20%_10%,#ffffff_0,#ffffff_24%,#f7f6f2_64%,#efeee9_100%)]">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 md:px-8 md:pb-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-[var(--shadow-soft)]">
                <MapPin className="h-3.5 w-3.5 text-coral-700" />
                Local directory
              </div>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-stone-900 md:text-6xl">
                Find the local spots people actually ask for.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
                Browse polished category grids for bars, sports, barbers, restaurants,
                shops, wellness, artists, and neighborhood events.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Link
                href="/explore"
                className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-900 px-4 py-4 text-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-300">
                    Directory
                  </span>
                  <span className="mt-1 block text-lg font-semibold tracking-tight">
                    All businesses
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/city"
                className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-4 text-stone-900 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                    Places
                  </span>
                  <span className="mt-1 block text-lg font-semibold tracking-tight">
                    Browse cities
                  </span>
                </span>
                <Store className="h-5 w-5 text-coral-700" />
              </Link>
              <Link
                href="/events"
                className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-4 text-stone-900 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                    Live
                  </span>
                  <span className="mt-1 block text-lg font-semibold tracking-tight">
                    Events nearby
                  </span>
                </span>
                <CalendarDays className="h-5 w-5 text-coral-700" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-8 md:pt-10">
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">Popular searches</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                Category grid
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-600">
              Tap a tile to jump straight into matching local listings.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group min-h-64 rounded-2xl border border-stone-200 bg-white p-4 shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ${card.tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                        {card.eyebrow}
                      </span>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-2xl font-semibold tracking-tight text-stone-900">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {card.description}
                      </p>
                    </div>

                    <div className="mt-auto pt-6">
                      <div className="flex flex-wrap gap-1.5">
                        {card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-stone-200 px-2 py-1 text-xs font-medium text-stone-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-sm font-semibold text-stone-900">
                        <span>Browse listings</span>
                        <ArrowRight className="h-4 w-4 text-coral-700 transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-soft)] md:p-6">
          <div className="grid gap-5 md:grid-cols-[18rem_1fr]">
            <div>
              <p className="section-label">Full taxonomy</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                Organized for browsing
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Business, artist, and organizer categories stay separated so the directory feels precise.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {TAXONOMY_GROUPS.map((group) => {
                const entries = Object.entries(TAXONOMY[group.type] ?? {});
                const GroupIcon =
                  group.type === "vendor" ? Store : group.type === "artist" ? Paintbrush : Users;

                return (
                  <div key={group.type} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-coral-700 ring-1 ring-stone-200">
                        <GroupIcon className="h-5 w-5" />
                      </span>
                      <h3 className="text-lg font-semibold text-stone-900">{group.label}</h3>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {entries.map(([category, subcategories]) => (
                        <Link
                          key={`${group.type}-${category}`}
                          href={categoryHref(category)}
                          className="group flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:text-stone-900 hover:ring-stone-300"
                          title={subcategories.join(", ")}
                        >
                          <span>{category}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-coral-700" />
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <Link
            href="/favorites"
            className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            <Heart className="h-5 w-5 text-coral-700" />
            <h2 className="mt-5 text-lg font-semibold text-stone-900">Saved spots</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Return to businesses and events you already liked.
            </p>
          </Link>
          <Link
            href="/shop"
            className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            <ShoppingBag className="h-5 w-5 text-coral-700" />
            <h2 className="mt-5 text-lg font-semibold text-stone-900">Local shop</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Browse products from nearby vendors and makers.
            </p>
          </Link>
          <Link
            href="/join"
            className="group rounded-2xl border border-stone-200 bg-stone-900 p-5 text-white shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            <Store className="h-5 w-5 text-coral-200" />
            <h2 className="mt-5 text-lg font-semibold">Add your business</h2>
            <p className="mt-1 text-sm leading-6 text-stone-300">
              Create a listing and show up in the local grid.
            </p>
          </Link>
        </section>

        <section className="mt-14 border-t border-stone-200 pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="section-label">All category pages</div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">
                Every indexable category
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-stone-600">
              These link to SEO category pages backed by the directory.
            </p>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:text-stone-900 hover:ring-stone-300"
              >
                <span>{c.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
