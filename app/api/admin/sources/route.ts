import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/admin'
import { SOURCES } from '@/lib/sources/registry'
import { CITIES, isCityLive } from '@/lib/cities'

// Real state of the sourcing pipeline, for the admin Sourcing screen.
//
// The screen used to render `SOURCES` from lib/prototype-data — six invented
// rows ("@eltechosf", "pulled 23 · published 18", "12 min ago") that had never
// been near the scraper. So the sources you could see were not the sources that
// ran, and the numbers were decoration. Everything below is measured: the
// recipes come from lib/sources/registry, the counts from the events they
// actually wrote.
//
// A city is live when it has at least one enabled source (lib/cities.ts) — the
// same rule the public city header uses, so admin and the app cannot disagree.

export const dynamic = 'force-dynamic'

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface SourceRow {
  id: string
  label: string
  site: string
  city: string
  category: string
  pattern: string
  enabled: boolean
  /** Events this source has in the table right now. */
  total: number
  /** Live in the feed. */
  published: number
  /** Scraped but held for review (see the Scraped drafts tab). */
  pending: number
  /** Date of the newest row it wrote — blank if it has never written one. */
  lastSeen: string | null
  /** The drift baseline from the registry, so a shortfall is visible. */
  expectAtLeast: number | null
}

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  // One grouped read rather than a query per source.
  const counts = new Map<string, { total: number; published: number; pending: number; lastSeen: string | null }>()
  try {
    const { data } = await db()
      .from('vendor_events')
      .select('source_id, active, reviewed_at, created_at')
      .not('source_id', 'is', null)
      .limit(5000)
    for (const r of (data ?? []) as { source_id: string; active: boolean; reviewed_at: string | null; created_at: string }[]) {
      const c = counts.get(r.source_id) ?? { total: 0, published: 0, pending: 0, lastSeen: null }
      c.total++
      if (r.active) c.published++
      else if (!r.reviewed_at) c.pending++
      const d = (r.created_at || '').slice(0, 10)
      if (d && (!c.lastSeen || d > c.lastSeen)) c.lastSeen = d
      counts.set(r.source_id, c)
    }
  } catch {
    // DB unreachable — still return the registry so the screen lists the real
    // recipes with zeroed counts, rather than showing nothing at all.
  }

  const sources: SourceRow[] = SOURCES.map((s) => {
    const c = counts.get(s.id)
    return {
      id: s.id,
      label: s.label,
      site: s.site,
      city: s.city,
      category: s.category,
      pattern: s.pattern,
      enabled: s.enabled !== false,
      total: c?.total ?? 0,
      published: c?.published ?? 0,
      pending: c?.pending ?? 0,
      lastSeen: c?.lastSeen ?? null,
      expectAtLeast: s.expectAtLeast ?? null,
    }
  })

  const cities = CITIES.map((c) => ({
    id: c.id,
    city: c.city,
    emoji: c.emoji,
    live: isCityLive(c.id),
    sourceCount: sources.filter((s) => s.city === c.id && s.enabled).length,
    published: sources.filter((s) => s.city === c.id).reduce((n, s) => n + s.published, 0),
  }))

  return NextResponse.json({ cities, sources })
}
