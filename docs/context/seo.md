# SEO & AI engine optimization (full)

## SEO & AI Engine Optimization
- **Brand name is `WhatsLocal AI`** (set as `SITE_NAME` in `lib/seo.ts`). Header, footer, page titles, emails (`hello@whatslocal.ai`) all use it. The old "The Collective" name has been fully removed from visible UI (only `lib/endorsements.ts` "Inglewood Collective" remains — that's a real-world org, not the brand).
- **Per-page metadata:** root `app/layout.tsx` sets `metadataBase` + title template `%s | WhatsLocal AI`. Member pages export `generateMetadata()` (title, description, canonical, OG/Twitter, type-aware `robots`).
- **Indexing policy (`isIndexable()` in `lib/seo.ts`):** index real-entity types (`vendor`/`artist`/`organizer`) **with substance** — including *unclaimed* harvested listings (long-tail directory model). Noindex shoppers, influencers, and content-thin profiles. To exclude all unclaimed profiles instead, edit `isIndexable`.
- **Structured data:** indexable member pages emit `LocalBusiness`/`Organization` JSON-LD; category/city landing pages emit `CollectionPage`+`ItemList`. Only fields we actually hold are emitted (no fabricated address/hours — avoids structured-data penalties).
- **Landing pages:** `/category` + `/category/[slug]` and `/city` + `/city/[slug]` are server-rendered SEO hubs that list indexable members; linked from the footer and the sitemap. Only non-empty categories / multi-listing cities are included.
- **Sitemap/robots/llms.txt** all resolve absolute URLs from `NEXT_PUBLIC_SITE_URL`.
