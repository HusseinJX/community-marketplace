export interface ShopperList {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
}

const KEY = "wl_shopper_lists";

function fallbackId(): string {
  return `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readShopperLists(): ShopperList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((list): list is ShopperList =>
        !!list &&
        typeof list.id === "string" &&
        typeof list.name === "string" &&
        Array.isArray(list.memberIds),
      )
      .map((list) => ({
        ...list,
        memberIds: list.memberIds.filter((id) => typeof id === "string"),
      }));
  } catch {
    return [];
  }
}

export function writeShopperLists(lists: ShopperList[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    /* private/full storage: list changes just won't persist */
  }
}

export function addMemberToShopperList(listId: string, memberId: string): ShopperList[] {
  const next = readShopperLists().map((list) =>
    list.id === listId && !list.memberIds.includes(memberId)
      ? { ...list, memberIds: [memberId, ...list.memberIds] }
      : list,
  );
  writeShopperLists(next);
  return next;
}

export function createShopperList(name: string, memberId?: string): ShopperList[] {
  const clean = name.trim().slice(0, 60);
  if (!clean) return readShopperLists();
  const existing = readShopperLists();
  const duplicate = existing.find((list) => list.name.toLowerCase() === clean.toLowerCase());
  if (duplicate && memberId) {
    return addMemberToShopperList(duplicate.id, memberId);
  }
  if (duplicate) return existing;
  const next = [
    {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId(),
      name: clean,
      memberIds: memberId ? [memberId] : [],
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ];
  writeShopperLists(next);
  return next;
}

export function savePublicShopperList(name: string, memberIds: string[]): ShopperList[] {
  const clean = name.trim().slice(0, 60);
  if (!clean) return readShopperLists();
  const ids = Array.from(new Set(memberIds.filter(Boolean)));
  const existing = readShopperLists();
  const duplicate = existing.find((list) => list.name.toLowerCase() === clean.toLowerCase());
  if (duplicate) {
    const next = existing.map((list) =>
      list.id === duplicate.id
        ? { ...list, memberIds: Array.from(new Set([...ids, ...list.memberIds])) }
        : list,
    );
    writeShopperLists(next);
    return next;
  }
  const next = [
    {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId(),
      name: clean,
      memberIds: ids,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ];
  writeShopperLists(next);
  return next;
}
