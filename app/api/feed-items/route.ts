import { NextResponse } from 'next/server'
import { listLiveFeedItems } from '@/lib/feed-items'

// GET — live WhatsLocal feed items (recaps, house voice). Public, identical for
// every viewer, cached in lib/feed-items. Drafts never come through here.
export async function GET() {
  try {
    return NextResponse.json({ items: await listLiveFeedItems(30) })
  } catch {
    // Seeded content is filler: if it fails, the feed simply has none.
    return NextResponse.json({ items: [] })
  }
}
