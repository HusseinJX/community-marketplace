// Polite HTTP for scraping: identifies the bot, times out, retries transient
// failures, limits concurrency, and counts requests so runs are auditable.

const UA = 'Mozilla/5.0 (compatible; WhatsLocalBot/1.0; +https://whatslocal.ai)'

/**
 * Some sites 403 a bot UA outright (SFJAZZ, DoTheBay). Where we still want the
 * data, an adapter may opt into a browser UA — a deliberate, per-source choice,
 * never the default.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

let requestCount = 0
export const requests = () => requestCount
export const resetRequests = () => {
  requestCount = 0
}

export interface FetchOpts {
  timeoutMs?: number
  retries?: number
  browserUa?: boolean
  accept?: string
}

export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const { timeoutMs = 20_000, retries = 2, browserUa = false, accept } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      requestCount++
      const res = await fetch(url, {
        headers: {
          'User-Agent': browserUa ? BROWSER_UA : UA,
          ...(accept ? { Accept: accept } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
      // 4xx is a real answer — don't burn retries on it.
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) throw new Error(`HTTP ${res.status}`)
        throw new Error(`HTTP ${res.status}`)
      }
      return await res.text()
    } catch (err) {
      lastErr = err
      if (String(err).includes('HTTP 4')) break
      if (attempt < retries) await sleep(400 * (attempt + 1))
    }
  }
  throw new Error(`fetch failed ${url}: ${lastErr}`)
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  return JSON.parse(await fetchText(url, { accept: 'application/json', ...opts })) as T
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Run tasks with a concurrency cap. Failures resolve to null rather than rejecting. */
export async function pooled<T, R>(
  items: T[],
  worker: (item: T, i: number) => Promise<R>,
  concurrency = 5
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      try {
        out[i] = await worker(items[i], i)
      } catch {
        out[i] = null
      }
    }
  })
  await Promise.all(runners)
  return out
}

// ── small HTML helpers, shared by every adapter ──────────────────────────────

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…',
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m)
}

/** Strip tags to readable text. */
export function toText(html: string | null | undefined): string {
  if (!html) return ''
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

export function absolute(base: string, href: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

/**
 * WordPress serves a RESIZED derivative in its JSON-LD; this returns the original.
 *
 * Funcheap's `Event.image` is the 80x80 admin thumbnail — literally 80 pixels
 * square, which on a full-bleed card is a smear. WordPress names derivatives
 * `<name>-WIDTHxHEIGHT.<ext>` beside the original `<name>.<ext>`, so dropping
 * that suffix is the whole trick: `Emporium-80x80.png` (80x80) → `Emporium.png`
 * (747x490), measured.
 *
 * It VERIFIES rather than assumes. The suffix pattern also matches perfectly
 * ordinary filenames, and a guessed URL that 404s is worse than a small image:
 * next/image 400s on a fetch failure, so the card would show nothing at all.
 * One HEAD per image, at ingest only — never on a read path.
 *
 * Scoped to `/wp-content/uploads/` so it cannot touch a CDN whose sizes are
 * path segments rather than derivative files.
 */
export async function fullSizeWordPressImage(url: string | null): Promise<string | null> {
  if (!url || !url.includes('/wp-content/uploads/')) return url
  const full = url.replace(/-\d+x\d+(\.\w+)(\?.*)?$/, '$1$2')
  if (full === url) return url
  try {
    const res = await fetch(full, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
    return res.ok ? full : url
  } catch {
    return url // network hiccup — keep the small one rather than risk a 404
  }
}
