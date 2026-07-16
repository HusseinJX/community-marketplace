import type { MetadataRoute } from "next";
import { SITE_URL, isIndexable, lastActiveMs } from "@/lib/seo";
import { CATEGORIES, citiesFrom, fetchAllMembers, membersInCategory } from "@/lib/landing";

// Regenerate at most once a day. Crawlers re-fetch the sitemap far more often
// than the directory changes, and each regeneration walks every member.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const members = await fetchAllMembers();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/events`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/category`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/city`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  // One URL per indexable member profile.
  const memberEntries: MetadataRoute.Sitemap = members
    .filter(isIndexable)
    .map((m) => {
      const ms = lastActiveMs(m);
      return {
        url: `${SITE_URL}/members/${m.id}`,
        lastModified: ms ? new Date(ms) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      };
    });

  // Category hubs — only those that actually have listings (avoid empty pages).
  const categoryEntries: MetadataRoute.Sitemap = CATEGORIES.filter(
    (c) => membersInCategory(members, c.slug).length > 0
  ).map((c) => ({
    url: `${SITE_URL}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // City hubs — derived list already excludes thin (single-listing) cities.
  const cityEntries: MetadataRoute.Sitemap = citiesFrom(members).map((c) => ({
    url: `${SITE_URL}/city/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...memberEntries, ...categoryEntries, ...cityEntries];
}
