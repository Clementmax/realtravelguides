import type { MetadataRoute } from "next";
import { getAuthors, getCategories, getPosts } from "@/lib/queries";
import { normalizePostSlug } from "@/lib/slug";

export const revalidate = 1800;

const BASE = "https://www.realtravelguides.com";

const RETIRED_CATEGORY_SLUGS = new Set([
  "food",
  "fooddrink",
  "hiddenplaces",
  "exhibitions",
]);

const INDEXABLE_AUTHORS = new Set(["elenarossetti", "sophiepicot"]);

// Duplicate of the Porto Ercole weekend article. The -1 URL redirects to the
// original; keep the row, but do not list it beside the canonical post.
const EXCLUDED_POST_SLUGS = new Set([
  "porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train-1",
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/` },
    { url: `${BASE}/about` },
    { url: `${BASE}/books` },
    { url: `${BASE}/journeysbyrail` },
    { url: `${BASE}/privacy` },
  ];

  // A category or author failure must reject this function. Catching it would
  // publish a 200 sitemap that omits those URLs; leaving it uncaught keeps the
  // last good ISR sitemap.
  const categories = await getCategories();
  for (const category of categories) {
    if (!category.slug || RETIRED_CATEGORY_SLUGS.has(category.slug)) continue;
    entries.push({
      url: `${BASE}/journeysbyrail/categories/${category.slug}`,
    });
  }

  const authors = await getAuthors();
  for (const author of authors) {
    if (!INDEXABLE_AUTHORS.has(author.slug)) continue;
    entries.push({ url: `${BASE}/${author.slug}` });
  }

  const posts = await getPosts();
  const seen = new Set<string>();
  for (const post of posts) {
    const slug = normalizePostSlug(post.slug);
    if (!slug || seen.has(slug) || EXCLUDED_POST_SLUGS.has(slug)) continue;
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

  return entries;
}
