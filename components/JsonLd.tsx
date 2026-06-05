import type { Member } from "@/lib/types";
import {
  SITE_NAME,
  SITE_URL,
  memberType,
  memberDescription,
  socialUrls,
  resolveHeroImages,
} from "@/lib/seo";

// Type-aware schema.org structured data for member profiles.
//   vendor | artist  → LocalBusiness   (rich SERP: name, address, geo, phone)
//   organizer        → Organization
//   shopper | other  → no schema (caller should not render this for them)
//
// Only fields we actually hold are emitted — incomplete LocalBusiness data
// (e.g. a fabricated address) risks a structured-data penalty, so everything
// is conditional.
function buildSchema(member: Member): Record<string, unknown> | null {
  const p = member.profile ?? {};
  const type = memberType(member);
  const url = `${SITE_URL}/members/${member.id}`;
  const name = (p.businessName as string) || (p.name as string) || "";
  if (!name) return null;

  const schemaType =
    type === "vendor" || type === "artist" ? "LocalBusiness" : type === "organizer" ? "Organization" : null;
  if (!schemaType) return null;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": url,
    name,
    url,
    description: memberDescription(member, 300),
  };

  const images = resolveHeroImages(member.id, p);
  if (images.length) schema.image = images;

  const sameAs = socialUrls(p);
  if (sameAs.length) schema.sameAs = sameAs;

  if (schemaType === "LocalBusiness") {
    // Address: only emit PostalAddress when we have a real street/locality.
    const street = p.businessAddress as string | undefined;
    const locality = p.city as string | undefined;
    if (street || locality) {
      const address: Record<string, string> = { "@type": "PostalAddress" };
      if (street) address.streetAddress = street;
      if (locality) address.addressLocality = locality;
      schema.address = address;
    }
    if (typeof p.latitude === "number" && typeof p.longitude === "number") {
      schema.geo = {
        "@type": "GeoCoordinates",
        latitude: p.latitude,
        longitude: p.longitude,
      };
    }
    if (p.businessPhone) schema.telephone = p.businessPhone as string;
    if (p.priceRange) schema.priceRange = p.priceRange as string;
    const category = (p.businessCategory || p.category) as string | undefined;
    if (category) schema.knowsAbout = category;
  }

  schema.isPartOf = { "@type": "WebSite", name: SITE_NAME, url: SITE_URL };
  return schema;
}

export function MemberJsonLd({ member }: { member: Member }) {
  const schema = buildSchema(member);
  if (!schema) return null;
  return (
    <script
      type="application/ld+json"
      // schema is built from our own typed fields — safe to serialize.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// CollectionPage + ItemList for a landing page (category or city hub). Helps
// search + AI engines understand the page as a curated list of businesses.
export function CollectionJsonLd({
  name,
  description,
  path,
  members,
}: {
  name: string;
  description: string;
  path: string;
  members: Member[];
}) {
  const url = `${SITE_URL}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url,
    url,
    name,
    description,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: members.length,
      itemListElement: members.slice(0, 50).map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/members/${m.id}`,
        name: (m.profile?.businessName as string) || (m.profile?.name as string) || "Member",
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
