import { Metadata } from "next";
import { getPosts, getCategories, getCategoryLabelMap } from "@/lib/queries";
import JourneysByRailIndex from "@/components/JourneysByRailIndex";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Journeys by Rail",
  description:
    "Your go-to travel blog for exploring Italy, France, Switzerland and Spain through unforgettable train adventures — rail routes, real travel expectations, and insider tips on local food, culture, and history.",
  alternates: { canonical: "/journeysbyrail" },
};

export default async function JourneysByRailPage() {
  const [posts, categories, categoryLabels] = await Promise.all([
    getPosts(),
    getCategories(),
    getCategoryLabelMap(),
  ]);

  const listings = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? "",
    cover: post.cover,
    categories: post.categories ?? [],
    read_minutes: post.read_minutes,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-pine md:text-4xl">
        Journeys by rail
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone">
        Detailed rail routes, real travel expectations, and insider tips on
        local food, culture, and history — from scenic day trips to full
        itineraries.
      </p>

      <JourneysByRailIndex
        posts={listings}
        categories={categories}
        categoryLabels={categoryLabels}
      />
    </div>
  );
}
