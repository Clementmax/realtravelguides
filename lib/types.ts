export type Author = {
  slug: string;
  name: string;
  photo: string;
  short_bio: string;
  full_bio: string[];
  contact_email: string;
};

export type Book = {
  slug: string;
  title: string;
  author_slug: string;
  cover: string;
  tagline: string;
  description: string;
  highlights: string[];
  amazon_url: string;
};

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  categories: string[];
  read_minutes: number;
  published_at: string;
  body: string;
  video_url?: string | null;
};

export type Category = string;

export type CategoryRecord = {
  slug: string;
  label: string;
};

// Derives a stable slug from any category label — used both by the app and
// the migration script, so new categories (added on the live site later,
// e.g. in Supabase or during a future Wix migration) just work without a
// code change. "Food & Drink" -> "fooddrink", "Scenic Routes" -> "scenicroutes".
export function slugifyCategory(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "");
}
