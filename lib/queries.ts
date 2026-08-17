import { supabase } from "@/lib/supabase";
import { authors as seedAuthors } from "@/lib/seed-data/authors";
import { books as seedBooks } from "@/lib/seed-data/books";
import { posts as seedPosts } from "@/lib/seed-data/posts";
import { categories as seedCategories } from "@/lib/seed-data/categories";
import { Author, Book, Post, CategoryRecord } from "@/lib/types";

export async function getCategories(): Promise<CategoryRecord[]> {
  if (!supabase) return seedCategories;
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("label");
  if (error || !data || data.length === 0) return seedCategories;
  return data as CategoryRecord[];
}

export async function getCategoryLabelMap(): Promise<Record<string, string>> {
  const list = await getCategories();
  return Object.fromEntries(list.map((c) => [c.slug, c.label]));
}

export async function getAuthors(): Promise<Author[]> {
  if (!supabase) return seedAuthors;
  const { data, error } = await supabase.from("authors").select("*");
  if (error || !data || data.length === 0) return seedAuthors;
  return data as Author[];
}

export async function getAuthor(slug: string): Promise<Author | undefined> {
  const list = await getAuthors();
  return list.find((a) => a.slug === slug);
}

export async function getBooks(): Promise<Book[]> {
  if (!supabase) return seedBooks;
  const { data, error } = await supabase.from("books").select("*");
  if (error || !data || data.length === 0) return seedBooks;
  return data as Book[];
}

export async function getBook(slug: string): Promise<Book | undefined> {
  const list = await getBooks();
  return list.find((b) => b.slug === slug);
}

export async function getBooksByAuthor(authorSlug: string): Promise<Book[]> {
  const list = await getBooks();
  return list.filter((b) => b.author_slug === authorSlug);
}

export async function getPosts(): Promise<Post[]> {
  if (!supabase) return seedPosts;
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("published_at", { ascending: false });
  if (error || !data || data.length === 0) return seedPosts;
  return data as Post[];
}

export async function getPost(slug: string): Promise<Post | undefined> {
  const list = await getPosts();
  return list.find((p) => p.slug === slug);
}

export async function getPostsByCategory(category: string): Promise<Post[]> {
  const list = await getPosts();
  return list.filter((p) => p.categories.includes(category));
}
