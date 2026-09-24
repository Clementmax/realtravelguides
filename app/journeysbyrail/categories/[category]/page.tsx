import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPostsByCategory, getCategories, getCategoryLabelMap } from "@/lib/queries";
import PostCard from "@/components/PostCard";

export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const labels = await getCategoryLabelMap();
  const label = labels[category];
  if (!label) return {};
  const title = `${label} | Journeys by Rail | Real Travel Guides`;
  const description = `Rail travel guides, itineraries and insider tips for ${label}.`;
  const url = `/journeysbyrail/categories/${category}`;
  return {
    title: `${label} | Journeys by Rail`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const labels = await getCategoryLabelMap();
  const label = labels[category];
  if (!label) notFound();

  const posts = await getPostsByCategory(category);

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
            <PostCard
              key={post.slug}
              post={post}
              categoryLabel={
                post.categories[0] === category
                  ? label
                  : labels[post.categories[0]]
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
