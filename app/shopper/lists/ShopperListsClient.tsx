"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ListPlus, Store } from "lucide-react";
import { readShopperLists, createShopperList, type ShopperList } from "@/lib/shopper-lists";
import { useDirectory } from "@/lib/data-hooks";
import { DEMO_MEMBERS } from "@/lib/demo-members";

export function ShopperListsClient() {
  const [lists, setLists] = useState<ShopperList[]>([]);
  const [name, setName] = useState("");
  const { members } = useDirectory();

  useEffect(() => {
    setLists(readShopperLists());
  }, []);

  const namesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of DEMO_MEMBERS) {
      const profile = member.profile ?? {};
      map.set(member.id, String(profile.name || profile.businessName || "Local business"));
    }
    for (const member of members) {
      const profile = member.profile ?? {};
      map.set(member.id, String(profile.name || profile.businessName || "Local business"));
    }
    return map;
  }, [members]);

  const create = () => {
    setLists(createShopperList(name));
    setName("");
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div>
        <p className="t-meta font-semibold uppercase tracking-[0.16em] text-coral-700">
          Shopper lists
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">My lists</h1>
        <p className="mt-1 t-meta text-stone-500">
          Save local shops into lists for plans, errands, classes, and places to try.
        </p>
      </div>

      <div className="mt-5 flex gap-2 rounded-2xl border border-stone-200 bg-white p-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New list name"
          className="min-w-0 flex-1 bg-transparent px-3 t-body text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 t-meta font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          <ListPlus className="h-4 w-4" />
          Create
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {lists.length ? (
          lists.map((list) => (
            <article key={list.id} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-stone-950">{list.name}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {list.memberIds.length} {list.memberIds.length === 1 ? "shop" : "shops"}
                  </p>
                </div>
                <Store className="h-5 w-5 text-stone-400" />
              </div>
              {list.memberIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {list.memberIds.slice(0, 8).map((id) => (
                    <Link
                      key={id}
                      href={`/members/${id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 transition hover:bg-stone-200"
                    >
                      {namesById.get(id) ?? "Local shop"}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-6 text-center">
            <p className="text-sm font-semibold text-stone-950">No lists yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Add shops from the Shop tab, or create a list here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
