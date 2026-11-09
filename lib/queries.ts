import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { authors as seedAuthors } from "@/lib/seed-data/authors";
import { books as seedBooks } from "@/lib/seed-data/books";
import { posts as seedPosts } from "@/lib/seed-data/posts";
import { categories as seedCategories } from "@/lib/seed-data/categories";
import { Author, Book, Post, PostListing, CategoryRecord } from "@/lib/types";
import { normalizePostSlug } from "@/lib/slug";
import { stripMigratedPostChrome } from "@/lib/clean-post-body";

// Categories, authors, and books stay on a 60-second cache. They are small,
// and the books and author pages still revalidate every minute.
//
// Article listings share one 30-minute cache. That select is the card,
// search, sitemap, and Continue Exploring fields only. It does not include
// body, images, or video_url. getPost() loads one full row, including the body, on the
// same interval. unstable_cache keeps generateMetadata and the page from
// repeating either fetch on every render.
//
// A Supabase error is thrown from inside the cached function. unstable_cache
// stores a resolved return value only, so the failure is not saved as an empty
// list or as the sample articles. Sample posts are returned only in local
// development when the Supabase URL and anon key are absent, and that branch
// stays outside the cache. Production throws if those credentials are missing.
const POST_REVALIDATE_SECONDS = 1800;

const POST_LISTING_COLUMNS =
  "slug, title, excerpt, cover, categories, places, read_minutes, published_at";
const POST_FULL_COLUMNS = `${POST_LISTING_COLUMNS}, body, video_url, images`;

const fetchCategories = unstable_cache(
  async () => {
    if (!supabase) return seedCategories;
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("label");
    if (error || !data || data.length === 0) return seedCategories;
    return data as CategoryRecord[];
  },
  ["categories"],
  { revalidate: 60, tags: ["categories"] }
);

export async function getCategories(): Promise<CategoryRecord[]> {
  return fetchCategories();
}

export async function getCategoryLabelMap(): Promise<Record<string, string>> {
  const list = await getCategories();
  return Object.fromEntries(list.map((c) => [c.slug, c.label]));
}

const fetchAuthors = unstable_cache(
  async () => {
    if (!supabase) return seedAuthors;
    const { data, error } = await supabase.from("authors").select("*");
    if (error || !data || data.length === 0) return seedAuthors;
    return data as Author[];
  },
  ["authors"],
  { revalidate: 60, tags: ["authors"] }
);

export async function getAuthors(): Promise<Author[]> {
  return fetchAuthors();
}

export async function getAuthor(slug: string): Promise<Author | undefined> {
  const list = await getAuthors();
  return list.find((a) => a.slug === slug);
}

const fetchBooks = unstable_cache(
  async () => {
    if (!supabase) return seedBooks;
    const { data, error } = await supabase.from("books").select("*");
    if (error || !data || data.length === 0) return seedBooks;
    return data as Book[];
  },
  ["books"],
  { revalidate: 60, tags: ["books"] }
);

export async function getBooks(): Promise<Book[]> {
  return fetchBooks();
}

export async function getBook(slug: string): Promise<Book | undefined> {
  const list = await getBooks();
  return list.find((b) => b.slug === slug);
}

export async function getBooksByAuthor(authorSlug: string): Promise<Book[]> {
  const list = await getBooks();
  return list.filter((b) => b.author_slug === authorSlug);
}

function toPostListing(post: {
  slug: string;
  title: string;
  excerpt?: string | null;
  cover: string;
  categories?: string[] | null;
  places?: string[] | null;
  read_minutes: number;
  published_at: string;
}): PostListing {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? "",
    cover: post.cover,
    categories: Array.isArray(post.categories) ? post.categories : [],
    places: Array.isArray(post.places) ? post.places : [],
    read_minutes: post.read_minutes,
    published_at: post.published_at,
  };
}

function toFullPost(post: Post): Post {
  return {
    ...post,
    ...toPostListing(post),
    body: stripMigratedPostChrome(post.body ?? ""),
  };
}

function devPostsWithoutSupabase(): boolean {
  return process.env.NODE_ENV !== "production" && !supabase;
}

function postQueryError(scope: string, error: { message?: string } | null): Error {
  const detail = error?.message?.trim();
  return new Error(detail ? `Supabase ${scope} failed: ${detail}` : `Supabase ${scope} failed`);
}

const fetchPostListings = unstable_cache(
  async (): Promise<PostListing[]> => {
    if (!supabase) {
      throw new Error("Supabase is not configured");
    }
    const { data, error } = await supabase
      .from("posts")
      .select(POST_LISTING_COLUMNS)
      .order("published_at", { ascending: false });
    if (error || data == null) {
      throw postQueryError("post listing", error);
    }
    return (data as PostListing[]).map((post) => toPostListing(post));
  },
  ["posts", "listing-v1"],
  { revalidate: POST_REVALIDATE_SECONDS, tags: ["posts"] }
);

const fetchFullPost = unstable_cache(
  async (slug: string): Promise<Post | null> => {
    if (!slug) return null;
    if (!supabase) {
      throw new Error("Supabase is not configured");
    }
    const { data, error } = await supabase
      .from("posts")
      .select(POST_FULL_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      throw postQueryError("post", error);
    }
    if (!data) return null;
    return toFullPost(data as Post);
  },
  ["post", "full-v1"],
  { revalidate: POST_REVALIDATE_SECONDS, tags: ["posts"] }
);

// Duplicate of the canonical Porto Ercole article. The row stays in the
// database and getPost() can still fetch it; the -1 URL redirects. Every
// listing goes through getPosts(), so this is the only filter they need.
const UNLISTED_POST_SLUGS = new Set([
  "porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train-1",
]);

export async function getPosts(): Promise<PostListing[]> {
  const posts = devPostsWithoutSupabase()
    ? seedPosts.map((post) => toPostListing(post))
    : await fetchPostListings();
  return posts.filter((post) => !UNLISTED_POST_SLUGS.has(normalizePostSlug(post.slug)));
}

export async function getPost(slug: string): Promise<Post | undefined> {
  if (!slug) return undefined;
  const target = normalizePostSlug(slug);
  if (!target) return undefined;
  if (devPostsWithoutSupabase()) {
    const seed = seedPosts.find((post) => normalizePostSlug(post.slug) === target);
    return seed ? toFullPost(seed) : undefined;
  }
  const listings = await fetchPostListings();
  const match = listings.find((post) => normalizePostSlug(post.slug) === target);
  if (!match) return undefined;
  const post = await fetchFullPost(match.slug);
  return post ?? undefined;
}

export async function getPostsByCategory(category: string): Promise<PostListing[]> {
  const list = await getPosts();
  return list.filter((p) => p.categories.includes(category));
}
