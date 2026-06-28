<!-- /autoplan restore point: /Users/xen/.gstack/projects/HusseinJX-community-marketplace/main-autoplan-restore-20260605-123329.md -->
# SEO + AI Engine Optimization Plan

## Objective
Make the community marketplace highly discoverable by Google, Bing, and AI engines (ChatGPT, Perplexity, Claude) so that people searching for local businesses get directed here — and so that AI engines cite and link to individual member profiles as authoritative local business sources.

## Problem Statement
Member profile pages are server-rendered (great) but invisible to search engines and AI crawlers because:
1. No `generateMetadata()` per member — every page shares the same generic title/description
2. No JSON-LD structured data — search engines can't understand what each business is
3. No `sitemap.ts` — Google doesn't know individual member pages exist
4. No `llms.txt` — AI engines have no roadmap to index the marketplace
5. No OG images — every link share looks generic, no branding

## Scope
Files to create/modify:
- `app/members/[id]/page.tsx` — add `generateMetadata()` + inject `<JsonLd>` component
- `components/JsonLd.tsx` — new reusable `LocalBusiness` + `Product` JSON-LD component
- `app/sitemap.ts` — new file, dynamic sitemap from all member IDs
- `app/robots.ts` — new file, allow all + point to sitemap
- `public/llms.txt` — plain-text index for AI crawlers
- `app/api/og/[id]/route.tsx` — per-member OG image via `@vercel/og` (Phase 2)

## Implementation Phases

### Phase 1: Core SEO (highest impact, ~3hr)
1. `generateMetadata()` on `app/members/[id]/page.tsx`
2. `components/JsonLd.tsx` — LocalBusiness + Product schema
3. Inject `<JsonLd>` into member profile page
4. `app/sitemap.ts` — dynamic, fetches all member IDs from connector API
5. `app/robots.ts`

### Phase 2: AI Engine Layer (~1hr)
6. `public/llms.txt` — structured plain-text site map for LLM crawlers
7. Verify `/api/search` returns clean JSON with `Content-Type: application/json`

### Phase 3: Rich Social + OG Images (~2hr)
8. `app/api/og/[id]/route.tsx` — per-member branded OG card via `@vercel/og`
9. Wire OG image URL into `generateMetadata()` openGraph.images

## Technical Design

### `generateMetadata()` — `app/members/[id]/page.tsx`
```ts
export async function generateMetadata({ params }: { params: { id: string } }) {
  const member = await getMember(params.id)
  return {
    title: `${member.name} — Community Marketplace`,
    description: member.bio || `${member.name} is a local business on the Community Marketplace.`,
    openGraph: {
      title: member.name,
      description: member.bio,
      images: member.photo ? [{ url: member.photo }] : [],
    },
  }
}
```

### `components/JsonLd.tsx`
```tsx
export function LocalBusinessJsonLd({ member, products }: { member: Member, products: Product[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: member.name,
    description: member.bio,
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/members/${member.id}`,
    telephone: member.phone,
    address: { "@type": "PostalAddress", addressLocality: member.city },
    image: member.photo,
    hasOfferCatalog: products.length ? {
      "@type": "OfferCatalog",
      itemListElement: products.map(p => ({
        "@type": "Offer",
        name: p.name,
        price: p.price,
        priceCurrency: "USD",
      }))
    } : undefined,
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}
```

### `app/sitemap.ts`
```ts
import { listMembers } from "@/lib/api"
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://marketplace.com"

export default async function sitemap() {
  const members = await listMembers()
  return [
    { url: SITE, lastModified: new Date(), priority: 1.0 },
    { url: `${SITE}/members`, lastModified: new Date(), priority: 0.9 },
    ...members.map(m => ({
      url: `${SITE}/members/${m.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  ]
}
```

### `public/llms.txt`
```
# Community Marketplace
A curated local marketplace connecting shoppers to makers, vendors, restaurants, and artisans.

## Key Pages
- / — Browse all local businesses and members
- /members/[id] — Individual business profile with products, location, events, contact

## Search API
GET /api/search?q=<query> — returns JSON list of matching members and products

## Categories
Food & beverage, handmade goods, artists, services, events, sustainability
```

## Success Criteria
- Every member page has a unique `<title>` and `<meta name="description">`
- JSON-LD `LocalBusiness` appears in page source for every member profile
- `GET /sitemap.xml` returns all member URLs
- `GET /llms.txt` returns plain-text index
- Google Search Console confirms pages are indexed
- ChatGPT / Perplexity returns member profile links when asked about local businesses in the area

## Out of Scope
- Paid search / ads
- Review/rating schema (needs a reviews feature first)
- Analytics dashboard for SEO traffic (PostHog already wired)
