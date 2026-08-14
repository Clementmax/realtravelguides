import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPostsByCategory } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS, Category } from "@/lib/types";
import PostCard from "@/components/PostCard";
import Newsletter from "@/components/Newsletter";

export async function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!CATEGORIES.includes(category as Category)) return {};
  const label = CATEGORY_LABELS[category as Category];
  return {
    title: `${label} | Journeys by Rail`,
    description: `Rail travel guides, itineraries and insider tips for ${label}.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!CATEGORIES.includes(category as Category)) notFound();

  const posts = await getPostsByCategory(category);
  const label = CATEGORY_LABELS[category as Category];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-widest text-clay-dark">
        Journeys by rail
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-pine md:text-4xl">
        {label}
      </h1>

      {posts.length === 0 ? (
        <p className="mt-8 text-sm text-stone">
          No posts in this category yet — check back soon.
        </p>
      ) : (
        <div className="mt-12 grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      <div className="mt-20">
        <Newsletter />
      </div>
    </div>
  );
}
