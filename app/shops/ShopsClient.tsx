"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ListPlus, Map, Store } from "lucide-react";
import { AddToListMenu } from "@/components/AddToListMenu";
import { HomeSearch } from "@/components/home/HomeSearch";
import { LocalDirectory } from "@/components/home/LocalDirectory";
import { MapView } from "@/components/MapView";
import { useDirectory } from "@/lib/data-hooks";
import { savePublicShopperList } from "@/lib/shopper-lists";

type ShopsView = "shops" | "lists" | "map";

const VIEWS: { id: ShopsView; label: string; icon: typeof Store }[] = [
  { id: "shops", label: "Shops", icon: Store },
  { id: "lists", label: "Lists", icon: ListPlus },
  { id: "map", label: "Map", icon: Map },
];

export function ShopsClient() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ShopsView>("shops");
  const { members } = useDirectory();

  const mapMembers = useMemo(
    () =>
      members.filter((member) => {
        const profile = member.profile ?? {};
        return typeof profile.latitude === "number" && typeof profile.longitude === "number";
      }),
    [members],
  );

  return (
    <main className="min-h-screen bg-stone-50 pb-24 pt-6">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-5">
          <p className="t-meta font-semibold uppercase tracking-[0.18em] text-coral-700">
            Local directory
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 md:text-5xl">
            Browse shops
          </h1>
          <p className="mt-2 max-w-2xl t-body text-stone-600">
            Find local businesses, makers, services, and neighborhood spots.
          </p>
        </div>
        <HomeSearch
          bare
          value={query}
          onValueChange={setQuery}
          placeholder="Search local businesses"
          showFilters
        />
        <div className="mt-4 inline-flex rounded-full bg-stone-100 p-1">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={active}
                className={
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 t-meta transition " +
                  (active
                    ? "bg-white font-semibold text-stone-950 shadow-[var(--shadow-soft)]"
                    : "text-stone-500 hover:text-stone-800")
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "shops" ? (
        <LocalDirectory query={query} showAddToList />
      ) : view === "lists" ? (
        <PublicListsView />
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-stone-200 bg-white">
            <MapView members={mapMembers} />
          </div>
        </div>
      )}
    </main>
  );
}

function PublicListsView() {
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:px-8">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
          Public creator lists
        </h2>
        <p className="mt-1 max-w-2xl t-meta text-stone-500">
          Browse public lists made by creators, locals, influencers, and tastemakers.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {PUBLIC_SHOP_LISTS.map((list) => (
          <article key={list.title} className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[var(--shadow-soft)]">
            <div className={`h-2 bg-gradient-to-r ${list.accent}`} />
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                by {list.creator}
              </p>
              <h3 className="mt-1 text-base font-semibold text-stone-950">{list.title}</h3>
              <p className="mt-1 text-sm leading-5 text-stone-500">{list.description}</p>
              <div className="mt-4 space-y-2">
                {list.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 rounded-2xl bg-stone-50 px-3 py-2">
                    <Link href={`/members/${member.id}`} className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-stone-900">{member.name}</span>
                      <span className="block text-xs text-stone-500">{member.category}</span>
                    </Link>
                    <AddToListMenu memberId={member.id} memberName={member.name} compact />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  savePublicShopperList(list.title, list.members.map((member) => member.id));
                  setSaved(list.title);
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                <ListPlus className="h-4 w-4" />
                {saved === list.title ? "Saved" : "Save list"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const PUBLIC_SHOP_LISTS = [
  {
    title: "Game day spots",
    creator: "Maya Courtside",
    description: "Bars and restaurants for watch parties, wings, loud rooms, and big screens.",
    accent: "from-amber-400 via-orange-500 to-coral-600",
    members: [
      { id: "demo-courtside-sports-bar", name: "Courtside Sports Bar", category: "Sports bar" },
      { id: "demo-el-tri-cantina", name: "El Tri Cantina", category: "Cantina" },
      { id: "demo-the-corner-tap", name: "The Corner Tap", category: "Neighborhood bar" },
    ],
  },
  {
    title: "Weekend workshops",
    creator: "Lena Makes",
    description: "Creative classes, plant sessions, and hands-on things to book with friends.",
    accent: "from-emerald-400 via-teal-500 to-cyan-500",
    members: [
      { id: "demo-dani-cruz", name: "Dani Cruz", category: "Art workshops" },
      { id: "demo-casa-verde", name: "Casa Verde Plant Co", category: "Plant workshops" },
      { id: "demo-kira-wave", name: "Kira Wave", category: "Music sessions" },
    ],
  },
  {
    title: "Late-night food run",
    creator: "Chef Nico",
    description: "Places to save for after events, games, rehearsals, or a long shift.",
    accent: "from-stone-700 via-stone-900 to-black",
    members: [
      { id: "demo-azteca-grill", name: "Azteca Grill & Bar", category: "Grill & bar" },
      { id: "demo-highland-pub", name: "Highland Pub", category: "Pub" },
      { id: "demo-el-tri-cantina", name: "El Tri Cantina", category: "Food & drink" },
    ],
  },
];
