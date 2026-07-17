// Unread badges without a read-state table.
//
// The server hands back every message reduced to { key, at, mine } (see
// /api/vendor/activity). "Last seen" lives HERE — one timestamp per thread in
// localStorage, stamped when you open it — and unread is simply "messages newer
// than that, which aren't mine". Per-device rather than per-account, which is
// the honest trade for not migrating a read-state table.

export type Activity = { key: string; at: string; mine: boolean }
export type SeenMap = Record<string, string> // thread id → ISO last-seen

const keyFor = (scope: string) => `wl_seen_${scope}`

export function loadSeen(scope: string): SeenMap {
  try {
    const raw = localStorage.getItem(keyFor(scope))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {}
  } catch {
    return {}
  }
}

export function saveSeen(scope: string, map: SeenMap): void {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify(map))
  } catch {
    /* private/full storage → badges just won't persist */
  }
}

const ms = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** Unread count per thread: their messages newer than your last look at it. */
export function countUnread(activity: Activity[], seen: SeenMap): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of activity) {
    if (a.mine) continue
    const since = seen[a.key] ? ms(seen[a.key]) : 0
    if (ms(a.at) > since) out[a.key] = (out[a.key] ?? 0) + 1
  }
  return out
}

export function totalUnread(counts: Record<string, number>): number {
  return Object.values(counts).reduce((n, v) => n + v, 0)
}
