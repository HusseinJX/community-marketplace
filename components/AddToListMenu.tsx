"use client";

import { useEffect, useState } from "react";
import { ListPlus, X } from "lucide-react";
import {
  addMemberToShopperList,
  createShopperList,
  readShopperLists,
  type ShopperList,
} from "@/lib/shopper-lists";

export function AddToListMenu({
  memberId,
  memberName,
  compact = false,
  buttonClassName,
}: {
  memberId: string;
  memberName: string;
  compact?: boolean;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ShopperList[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setLists(readShopperLists());
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Add ${memberName} to a list`}
        className={
          buttonClassName ??
          "inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 transition hover:bg-stone-200"
        }
      >
        <ListPlus className="h-3.5 w-3.5" />
        <span className={compact ? "sr-only" : ""}>Add to list</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-[var(--shadow-overlay)]">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-stone-500">Choose list</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close list menu"
              className="grid h-6 w-6 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {lists.length > 0 ? (
            <div className="max-h-36 overflow-y-auto">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    setLists(addMemberToShopperList(list.id, memberId));
                    setOpen(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-stone-800 hover:bg-stone-50"
                >
                  {list.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-stone-500">No lists yet.</p>
          )}
          <div className="mt-2 flex gap-1 border-t border-stone-100 pt-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New list"
              className="min-w-0 flex-1 rounded-full bg-stone-100 px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setLists(createShopperList(name, memberId));
                setName("");
                setOpen(false);
              }}
              disabled={!name.trim()}
              className="rounded-full bg-stone-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
