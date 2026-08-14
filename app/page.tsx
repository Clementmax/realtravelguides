import Link from "next/link";
import Image from "next/image";
import { getBooks, getPosts } from "@/lib/queries";
import BookCard from "@/components/BookCard";
import PostCard from "@/components/PostCard";
import Newsletter from "@/components/Newsletter";

export default async function HomePage() {
  const [books, posts] = await Promise.all([getBooks(), getPosts()]);
  const latestPosts = posts.slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero */}
      <section className="grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-clay-dark">
            Slow · Sustainable · Self-guided
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-pine md:text-5xl">
            Discover Europe the way it was meant to be seen — by rail
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-stone">
            Independent, low-impact travel guides for people who&apos;d
            rather wander a hill town than sit on a coach tour. No organized
            tours, no rigid schedules — just practical advice from local
            experts.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/books"
              className="rounded-md bg-moss px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-moss-dark"
            >
              Explore the guides
            </Link>
            <Link
              href="/journeysbyrail"
              className="rounded-md border border-border-line px-6 py-3 text-sm font-medium text-pine transition-colors hover:bg-paper-raised"
            >
              Read the blog
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border-line">
          <Image
            src="/images/hero.jpg"
            alt="Scenic European rail journey"
            fill
            priority
            className="object-cover"
          />
        </div>
      </section>

      {/* Why us */}
      <section className="grid gap-8 border-t border-border-line py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold text-pine">
            Independent self-guided travel
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Clear, step-by-step itineraries you can customise or combine, with
            maps, journey times, and money-saving tips for every trip.
          </p>
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-pine">
            Local insight, real expertise
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Written with on-the-ground contributors who live the culture
            every day — honest advice on food, customs, safety, and hidden
            gems.
          </p>
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-pine">
            Slow, responsible exploration
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Travel by rail and other low-impact transport, visiting
            lesser-known towns and coastal getaways while respecting local
            communities.
          </p>
        </div>
      </section>

      {/* Books */}
      <section className="border-t border-border-line py-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-pine">
            Our guides
          </h2>
          <Link href="/books" className="text-sm text-moss hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.slug} book={book} />
          ))}
        </div>
      </section>

      {/* Blog */}
      <section className="border-t border-border-line py-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-pine">
            Latest from journeys by rail
          </h2>
          <Link
            href="/journeysbyrail"
            className="text-sm text-moss hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {latestPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>

      <section className="border-t border-border-line py-16">
        <Newsletter />
      </section>
    </div>
  );
}
