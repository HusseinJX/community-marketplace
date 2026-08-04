import Link from "next/link";

// Isolated prototype sandbox. Touches nothing in the real app. Throwaway.
const TABS = [
  { href: "/prototype/feed", label: "Feed", emoji: "📍" },
  { href: "/prototype/create", label: "Create", emoji: "✨" },
  { href: "/prototype/host", label: "Book", emoji: "🗓️" },
  { href: "/prototype/admin", label: "Sourcing", emoji: "⚙️" },
];

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900">
      <div className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-1 px-3 py-2">
          <span className="mr-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Prototype
          </span>
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-md px-3 pb-24 pt-3 lg:max-w-4xl">{children}</div>
    </div>
  );
}
