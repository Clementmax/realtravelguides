import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { authors as seedAuthors } from "@/lib/seed-data/authors";
import { books as seedBooks } from "@/lib/seed-data/books";
import { posts as seedPosts } from "@/lib/seed-data/posts";
import { categories as seedCategories } from "@/lib/seed-data/categories";
import { Author, Book, Post, CategoryRecord } from "@/lib/types";
import { normalizePostSlug } from "@/lib/slug";
import { stripMigratedPostChrome } from "@/lib/clean-post-body";

// Matches the `revalidate = 60` already set on the pages that use these.
// Without this cache, every statically generated post page independently
// re-fetches the *entire* posts/categories table during build (and during
// each revalidation), since generateMetadata and the page component each
// call getPost()/getCategoryLabelMap() separately. unstable_cache makes
// each table fetch happen once per 60s window and reuses it across every
// page, instead of once per page.
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

const fetchPosts = unstable_cache(
  async () => {
    if (!supabase) {
      return seedPosts.map((post) => ({
        ...post,
        body: stripMigratedPostChrome(post.body),
      }));
    }
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("published_at", { ascending: false });
    if (error || !data || data.length === 0) return seedPosts;
    return (data as Post[]).map((post) => ({
      ...post,
      body: stripMigratedPostChrome(post.body),
    }));
  },
  ["posts", "v2-strip-chrome"],
  { revalidate: 60, tags: ["posts"] }
);

export async function getPosts(): Promise<Post[]> {
  return fetchPosts();
}

export async function getPost(slug: string): Promise<Post | undefined> {
  if (!slug) return undefined;
  const list = await getPosts();
  const target = normalizePostSlug(slug);
  return list.find((p) => normalizePostSlug(p.slug) === target);
}

export async function getPostsByCategory(category: string): Promise<Post[]> {
  const list = await getPosts();
  return list.filter((p) => p.categories.includes(category));
}
