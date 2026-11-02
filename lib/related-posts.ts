import { normalizePostSlug } from "@/lib/slug";

/**
 * Broad regions. They break ties between candidates that already share a
 * specific destination or railway route. They match on their own only when
 * the current article has no specific destination and no railway route.
 */
const BROAD_REGIONS = new Set(["tuscany", "umbria"]);

/**
 * Railway routes, same rank as a town, city, or lake.
 * `bernina` is the saved route tag. Add future route tags here; do not infer them from titles.
 */
const RAILWAY_ROUTES = new Set(["bernina"]);

/** Country and theme categories are not place matches, even if they appear in `places`. */
const NON_PLACE_TAGS = new Set([
  "italy",
  "france",
  "switzerland",
  "spain",
  "culture",
  "scenicroutes",
]);

/** Duplicate of the Porto Ercole article; never recommend it. */
const EXCLUDED_SLUG = "porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train-1";

export type RelatedPostSource = {
  slug: string;
  places?: readonly string[] | null;
  published_at?: string | null;
};

function placeList(post: RelatedPostSource): string[] {
  if (!post.places) return [];
  const seen = new Set<string>();
  for (const value of post.places) {
    if (typeof value !== "string") continue;
    const slug = value.trim().toLowerCase();
    if (!slug || NON_PLACE_TAGS.has(slug)) continue;
    seen.add(slug);
  }
  return [...seen];
}

/** A post is published when `published_at` is a real date that is today or earlier. */
function isPublished(value: string | null | undefined, now: Date): boolean {
  if (typeof value !== "string") return false;
  const raw = value.trim();
  if (!raw) return false;
  const day = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return day <= calendarDay(now);
  }
  const time = new Date(raw).getTime();
  return !Number.isNaN(time) && time <= now.getTime();
}

function calendarDay(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function publishedTime(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Specific destinations, railway routes, and broad regions, in that order of closeness. */
function placeTiers(places: readonly string[]): {
  specific: string[];
  routes: string[];
  broad: string[];
} {
  const specific: string[] = [];
  const routes: string[] = [];
  const broad: string[] = [];
  for (const place of places) {
    if (RAILWAY_ROUTES.has(place)) routes.push(place);
    else if (BROAD_REGIONS.has(place)) broad.push(place);
    else specific.push(place);
  }
  return { specific, routes, broad };
}

/**
 * Up to three other published posts related by saved place tags.
 *
 * A current article with a specific destination (town, city, lake, or any
 * other place that is not a broad region or railway route) only recommends
 * posts that share at least one of those destinations. A shared region does
 * not fill a remaining slot.
 *
 * A current article with a railway route such as `bernina` only recommends
 * posts that share that route. Region-only matches do not fill remaining slots.
 *
 * A current article with only broad region tags (`tuscany` or `umbria`) may
 * recommend any published post that includes that region, including articles
 * about towns inside it.
 *
 * More shared destinations or routes rank first. A shared region then breaks
 * ties, then newer `published_at`, then slug A–Z. Country categories are not
 * used. Fewer than three matches returns a shorter list.
 */
export function selectRelatedPosts<T extends RelatedPostSource>(
  current: T,
  posts: readonly T[],
  limit = 3,
  now = new Date()
): T[] {
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  if (max === 0) return [];

  const currentSlug = normalizePostSlug(current.slug);
  const excludedSlug = normalizePostSlug(EXCLUDED_SLUG);
  const currentPlaces = new Set(placeList(current));
  if (currentPlaces.size === 0) return [];

  const currentTiers = placeTiers([...currentPlaces]);
  const requiresSpecific = currentTiers.specific.length > 0;
  const requiresRoute = currentTiers.routes.length > 0;

  const ranked: {
    post: T;
    slug: string;
    high: number;
    broad: number;
    published: number;
  }[] = [];

  for (const post of posts) {
    const slug = normalizePostSlug(post.slug);
    if (!slug || slug === currentSlug || slug === excludedSlug) continue;
    if (!isPublished(post.published_at, now)) continue;

    const shared = placeList(post).filter((place) => currentPlaces.has(place));
    if (shared.length === 0) continue;

    const sharedTiers = placeTiers(shared);
    // Region overlap never qualifies a candidate on its own once the current
    // article has a specific destination or a railway route.
    if (requiresSpecific && sharedTiers.specific.length === 0) continue;
    if (requiresRoute && sharedTiers.routes.length === 0) continue;
    if (!requiresSpecific && !requiresRoute && sharedTiers.broad.length === 0) continue;

    ranked.push({
      post,
      slug,
      high: sharedTiers.specific.length + sharedTiers.routes.length,
      broad: sharedTiers.broad.length,
      published: publishedTime(post.published_at),
    });
  }

  ranked.sort((a, b) => {
    if (b.high !== a.high) return b.high - a.high;
    if (b.broad !== a.broad) return b.broad - a.broad;
    if (b.published !== a.published) return b.published - a.published;
    if (a.slug < b.slug) return -1;
    if (a.slug > b.slug) return 1;
    return 0;
  });

  return ranked.slice(0, max).map((entry) => entry.post);
}
