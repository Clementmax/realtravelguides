import type { MetadataRoute } from "next";
import { getAuthors, getCategories, getPosts } from "@/lib/queries";
import { normalizePostSlug } from "@/lib/slug";

export const revalidate = 60;

const BASE = "https://www.realtravelguides.com";

const RETIRED_CATEGORY_SLUGS = new Set([
  "food",
  "fooddrink",
  "hiddenplaces",
  "exhibitions",
]);

const INDEXABLE_AUTHORS = new Set(["elenarossetti", "sophiepicot"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/` },
    { url: `${BASE}/about` },
    { url: `${BASE}/books` },
    { url: `${BASE}/journeysbyrail` },
  ];

  try {
    const categories = await getCategories();
    for (const category of categories) {
      if (!category.slug || RETIRED_CATEGORY_SLUGS.has(category.slug)) continue;
      entries.push({
        url: `${BASE}/journeysbyrail/categories/${category.slug}`,
      });
    }
  } catch {
    // Static pages remain if category data is unavailable.
  }

  try {
    const authors = await getAuthors();
    for (const author of authors) {
      if (!INDEXABLE_AUTHORS.has(author.slug)) continue;
      entries.push({ url: `${BASE}/${author.slug}` });
    }
  } catch {
    // Static pages remain if author data is unavailable.
  }

  try {
    const posts = await getPosts();
    const seen = new Set<string>();
    for (const post of posts) {
      const slug = normalizePostSlug(post.slug);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);

      const entry: MetadataRoute.Sitemap[number] = {
        url: `${BASE}/post/${encodeURI(slug)}`,
      };
      if (post.published_at) {
        const published = new Date(post.published_at);
        if (!Number.isNaN(published.getTime())) entry.lastModified = published;
      }
      entries.push(entry);
    }
  } catch {
    // Static pages remain if posts are unavailable.
  }

  return entries;
}
