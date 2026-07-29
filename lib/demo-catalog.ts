// Demo fixtures for the vendor catalog managers (/vendor/products, /vendor/events).
// Used only in the Admin demo, where there's no real backend member — so the
// CRUD UIs render with sample rows (incl. a pending-approval draft + an AI-
// sourced item) instead of an empty state. Writes no-op locally (handled in the
// managers). Mirrors the Product / VEvent shapes those components use.

export interface DemoProduct {
  id: string
  name: string
  description: string | null
  price: number // cents
  currency: string
  image_url: string | null
  active: boolean
  source?: string
}

export interface DemoVendorEvent {
  id: string
  title: string
  description: string | null
  event_date: string | null
  event_time: string | null
  location: string | null
  poster_image_url: string | null
  source: string
  active: boolean
}

export function demoProducts(): DemoProduct[] {
  return [
    { id: 'demo-prod-1', name: 'House Nachos', description: 'Loaded with carne asada, cotija & pico', price: 1400, currency: 'usd', image_url: null, active: true, source: 'manual' },
    { id: 'demo-prod-2', name: 'Game Day Wings (12)', description: 'Buffalo, BBQ, or dry rub', price: 1800, currency: 'usd', image_url: null, active: true, source: 'manual' },
    { id: 'demo-prod-3', name: 'Draft Pitcher', description: 'Local IPA or lager, 64oz', price: 2200, currency: 'usd', image_url: null, active: true, source: 'square' },
    { id: 'demo-prod-4', name: 'Courtside Tee', description: 'Black cotton logo tee', price: 2800, currency: 'usd', image_url: null, active: true, source: 'manual' },
    // A pending-approval draft (AI-captured) so the approval queue is visible.
    { id: 'demo-prod-draft', name: 'Loaded Fries', description: 'Detected from your menu photo', price: 1100, currency: 'usd', image_url: null, active: false, source: 'ai_menu' },
  ]
}

export function demoVendorEvents(): DemoVendorEvent[] {
  return [
    { id: 'demo-vevent-1', title: 'Big Match Watch Party', description: 'Big screens, drink specials, full menu', event_date: 'Sun, Jul 12', event_time: '12:00 PM', location: 'Courtside Sports Bar', poster_image_url: null, source: 'manual', active: true },
    { id: 'demo-vevent-2', title: 'Trivia Night', description: 'Weekly trivia — prizes for the top 3 teams', event_date: 'Thu, Jul 16', event_time: '7:00 PM', location: 'Courtside Sports Bar', poster_image_url: null, source: 'manual', active: true },
    // A draft (AI-captured flyer) so the publish flow is visible.
    { id: 'demo-vevent-draft', title: 'Live Jazz Brunch', description: 'Detected from your flyer', event_date: 'Sat, Jul 18', event_time: '11:00 AM', location: 'Courtside Sports Bar', poster_image_url: null, source: 'ai_events', active: false },
  ]
}
