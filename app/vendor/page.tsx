import { withAuth } from "@workos-inc/authkit-nextjs";
import { Package, ShoppingCart, CreditCard, Calendar, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const iconMap = {
  Products: Package,
  Orders: ShoppingCart,
  Payments: CreditCard,
} as const;

const DEMO_PRODUCTS = [
  {
    id: "p1",
    name: "Solar Panel Bundle (400W)",
    description: "High-efficiency monocrystalline panels with weatherproof mounting hardware. Perfect for residential rooftop installations.",
    price: 89900,
    badge: "Best Seller",
    badgeColor: "bg-emerald-100 text-emerald-700",
    img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80",
    gradient: "from-amber-300 to-orange-400",
  },
  {
    id: "p2",
    name: "Home Battery Pack (10kWh)",
    description: "Lithium iron phosphate storage with smart inverter. Pairs with any solar system for 24/7 clean energy independence.",
    price: 349900,
    badge: "New",
    badgeColor: "bg-indigo-100 text-indigo-700",
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    gradient: "from-sky-300 to-blue-400",
  },
  {
    id: "p3",
    name: "Smart Energy Monitor Kit",
    description: "Real-time consumption tracking with app integration. Identify savings opportunities and monitor your solar production.",
    price: 14900,
    badge: null,
    badgeColor: "",
    img: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80",
    gradient: "from-violet-300 to-purple-400",
  },
];

const DEMO_EVENTS = [
  {
    id: "e1",
    title: "Free Solar Consultation Day",
    date: "Sat, Jun 7",
    time: "10:00 AM – 2:00 PM",
    location: "Downtown LA Maker Space",
    description: "Meet our engineers for a one-on-one rooftop assessment. Learn about incentives, tax credits, and custom install quotes — no pressure.",
    gradient: "from-amber-300 to-orange-500",
    platform: "In-person",
  },
  {
    id: "e2",
    title: "Clean Energy Workshop",
    date: "Thu, Jun 19",
    time: "6:00 PM – 8:00 PM",
    location: "Echo Park Community Center",
    description: "Hands-on intro to home solar + battery systems. We'll walk through real installs, costs, and the new CA incentive programs.",
    gradient: "from-emerald-300 to-teal-500",
    platform: "Free",
  },
  {
    id: "e3",
    title: "Sustainable Living Expo 2026",
    date: "Sat, Jul 12",
    time: "9:00 AM – 5:00 PM",
    location: "Grand Park, Los Angeles",
    description: "Zahab Energy is exhibiting at LA's largest sustainability fair. Stop by booth 14 for demos, giveaways, and exclusive expo pricing.",
    gradient: "from-sky-300 to-indigo-500",
    platform: "Expo",
  },
];

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default async function VendorDashboard() {
  const { user } = await withAuth();

  const cards = [
    { label: "Products", value: "3", href: "/vendor/products" },
    { label: "Orders", value: "—", href: "/vendor/orders" },
    { label: "Payments", value: "—", href: "/vendor/payments" },
  ] as const;

  return (
    <div className="space-y-10">
      <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-stone-500">{user?.email}</p>
      </div>

      {/* Quick access */}
      <div>
        <p className="section-label mb-4">Quick access</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => {
            const Icon = iconMap[card.label];
            return (
              <Link key={card.label} href={card.href}>
                <div className="card-soft card-hover p-6">
                  <Icon className="h-6 w-6 text-indigo-500" />
                  <p className="mt-3 text-sm font-medium text-stone-500">{card.label}</p>
                  <p className="mt-1 text-3xl font-semibold text-stone-900">{card.value}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Products */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="section-label">My Products</p>
          <Link
            href="/vendor/products"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DEMO_PRODUCTS.map((product) => (
            <div key={product.id} className="card-soft card-hover overflow-hidden group">
              <div className="relative h-44 w-full overflow-hidden">
                <Image
                  src={product.img}
                  alt={product.name}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-20`} />
                {product.badge && (
                  <span className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${product.badgeColor}`}>
                    {product.badge}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-stone-900 leading-tight group-hover:text-indigo-700 transition">
                  {product.name}
                </h3>
                <p className="mt-1.5 text-sm text-stone-500 line-clamp-2">{product.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-semibold text-stone-900">{formatPrice(product.price)}</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 hover:border-indigo-400 hover:text-indigo-600 transition">
          <Plus className="h-4 w-4" />
          Add product
        </button>
      </div>

      {/* Events */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="section-label">My Events</p>
          <Link
            href="/vendor/events"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DEMO_EVENTS.map((event) => (
            <article key={event.id} className="card-soft card-hover overflow-hidden group">
              <div className={`h-2 w-full bg-gradient-to-r ${event.gradient}`} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-stone-900 group-hover:text-indigo-700 transition leading-tight">
                    {event.title}
                  </h3>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    {event.platform}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {event.date}
                  </span>
                  <span>{event.time}</span>
                  <span>{event.location}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-stone-700 line-clamp-3">
                  {event.description}
                </p>
              </div>
            </article>
          ))}
        </div>
        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 hover:border-indigo-400 hover:text-indigo-600 transition">
          <Plus className="h-4 w-4" />
          Create event
        </button>
      </div>

      {/* Account setup notice */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-900">Account setup required</p>
        <p className="mt-1 text-sm text-amber-700">
          Connect your store profile to start managing products and receiving payments.
        </p>
      </div>
    </div>
  );
}
