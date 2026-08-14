import Link from "next/link";
import { Metadata } from "next";
import { getPosts } from "@/lib/queries";
import { CATEGORIES, CATEGORY_LABELS, Category } from "@/lib/types";
import PostCard from "@/components/PostCard";
import Newsletter from "@/components/Newsletter";

export const metadata: Metadata = {
  title: "Journeys by Rail",
  description:
    "Your go-to travel blog for exploring Italy, France, Switzerland and Spain through unforgettable train adventures — rail routes, real travel expectations, and insider tips on local food, culture, and history.",
};

export default async function JourneysByRailPage() {
  const posts = await getPosts();

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

      <div className="mt-8 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/journeysbyrail/categories/${c}`}
            className="rounded-full border border-border-line px-3 py-1 text-xs text-stone transition-colors hover:border-moss hover:text-moss"
          >
            {CATEGORY_LABELS[c as Category]}
          </Link>
        ))}
      </div>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>

      <div className="mt-20">
        <Newsletter />
      </div>
    </div>
  );
}
