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
  category: string;
  read_minutes: number;
  published_at: string;
  body: string;
};

export const CATEGORIES = [
  "switzerland",
  "france",
  "italy",
  "spain",
  "food",
  "culture",
  "scenicroutes",
  "hiddenplaces",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  switzerland: "Switzerland",
  france: "France",
  italy: "Italy",
  spain: "Spain",
  food: "Food & drink",
  culture: "Culture",
  scenicroutes: "Scenic routes",
  hiddenplaces: "Hidden places",
};
