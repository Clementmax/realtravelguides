import { normalizePostSlug } from "@/lib/slug";

/**
 * Regions and railway routes used by Continue Exploring.
 * Add new regions and routes here. A town is never inferred to belong to a
 * region: articles match a region only when they share that region tag.
 * Different railway routes never match each other.
 *
 * Towns, lakes, and smaller areas stay destinations. That includes
 * valtellina, chianti, crete-senesi, val-di-chiana, langhe, amalfi-coast,
 * cinque-terre, aeolian-islands, and every lake-* tag.
 */
const REGIONS = new Set([
  "alsace",
  "asturias",
  "beaujolais",
  "brittany",
  "burgundy",
  "cote-d-azur",
  "lavaux",
  "le-marche",
  "loire-valley",
  "normandy",
  "piedmont",
  "pyrenees",
  "ticino",
  "tuscany",
  "umbria",
  "veneto",
  // Not on a published article yet.
  "puglia",
  "galicia",
  "andalusia",
  "emilia-romagna",
]);

const RAILWAY_ROUTES = new Set([
  "bernina",
  "black-forest-railway",
  "cevennes-line",
  "circumetnea",
  "glacier-express",
  "goldenpass",
  "gotthard",
  "nice-menton-railway",
  "train-des-pignes",
  "train-jaune",
  "voralpen-express",
]);

/**
 * Either direction counts. A pair is a sibling match only when the articles
 * do not already share either tag. Sharing lucerne exactly is an exact
 * destination match, not an extra sibling boost.
 */
const SIBLING_DESTINATIONS: readonly (readonly [string, string])[] = [
  ["lucerne", "lake-lucerne"],
  ["como", "lake-como"],
  ["geneva", "lake-geneva"],
  ["amalfi", "amalfi-coast"],
];

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

/** Destinations are every place tag that is not a region and not a route. */
function splitPlaces(places: readonly string[]): {
  destinations: string[];
  routes: string[];
  regions: string[];
} {
  const destinations: string[] = [];
  const routes: string[] = [];
  const regions: string[] = [];
  for (const place of places) {
    if (RAILWAY_ROUTES.has(place)) routes.push(place);
    else if (REGIONS.has(place)) regions.push(place);
    else destinations.push(place);
  }
  return { destinations, routes, regions };
}

function sharedCount(left: readonly string[], right: ReadonlySet<string>): number {
  let count = 0;
  for (const tag of left) if (right.has(tag)) count += 1;
  return count;
}

/** 1 when any sibling pair crosses, otherwise 0. Exact overlap of that pair is not a sibling. */
function siblingScore(current: ReadonlySet<string>, candidate: ReadonlySet<string>): number {
  for (const [a, b] of SIBLING_DESTINATIONS) {
    if ((current.has(a) && candidate.has(a)) || (current.has(b) && candidate.has(b))) continue;
    if ((current.has(a) && candidate.has(b)) || (current.has(b) && candidate.has(a))) return 1;
  }
  return 0;
}

/**
 * Up to three other published posts for Continue Exploring.
 *
 * A candidate qualifies when it shares at least one exact destination, the
 * same named railway route, a sibling destination, or a geographical region.
 * Sharing a route is enough on its own. A shared region is enough when the
 * towns differ. Different routes never match each other, and unrelated posts
 * are not added to fill the three slots.
 *
 * Rank: count of shared exact destinations, then shared railway routes, then
 * a sibling destination (0 or 1), then shared regions, then newer
 * `published_at`, then slug A–Z. The current slug, unpublished or future
 * posts, and the duplicate Porto Ercole slug are left out. Country and theme
 * tags are not places.
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
  const currentPlaces = placeList(current);
  if (currentPlaces.length === 0) return [];

  const currentTiers = splitPlaces(currentPlaces);
  const currentSet = new Set(currentPlaces);

  const ranked: {
    post: T;
    slug: string;
    exact: number;
    routes: number;
    sibling: number;
    regions: number;
    published: number;
  }[] = [];

  for (const post of posts) {
    const slug = normalizePostSlug(post.slug);
    if (!slug || slug === currentSlug || slug === excludedSlug) continue;
    if (!isPublished(post.published_at, now)) continue;

    const candidatePlaces = placeList(post);
    const candidateSet = new Set(candidatePlaces);
    const exact = sharedCount(currentTiers.destinations, candidateSet);
    const routes = sharedCount(currentTiers.routes, candidateSet);
    const regions = sharedCount(currentTiers.regions, candidateSet);
    const sibling = siblingScore(currentSet, candidateSet);
    if (exact === 0 && routes === 0 && sibling === 0 && regions === 0) continue;

    ranked.push({
      post,
      slug,
      exact,
      routes,
      sibling,
      regions,
      published: publishedTime(post.published_at),
    });
  }

  ranked.sort((a, b) => {
    if (b.exact !== a.exact) return b.exact - a.exact;
    if (b.routes !== a.routes) return b.routes - a.routes;
    if (b.sibling !== a.sibling) return b.sibling - a.sibling;
    if (b.regions !== a.regions) return b.regions - a.regions;
    if (b.published !== a.published) return b.published - a.published;
    if (a.slug < b.slug) return -1;
    if (a.slug > b.slug) return 1;
    return 0;
  });

  return ranked.slice(0, max).map((entry) => entry.post);
}
