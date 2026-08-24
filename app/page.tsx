import Link from "next/link";
import { getBooks, getPosts, getAuthors, getCategoryLabelMap } from "@/lib/queries";

// Re-checks Supabase for fresh content every 60 seconds, rather than only
// at deploy time — otherwise edits made directly in Supabase (books,
// posts, categories) wouldn't appear on the live site until the next push.
export const revalidate = 60;
import BookCard from "@/components/BookCard";
import PostCard from "@/components/PostCard";
import DestinationCard from "@/components/DestinationCard";
import JourneyCard from "@/components/JourneyCard";
import AuthorCard from "@/components/AuthorCard";
import Newsletter from "@/components/Newsletter";
import HeroCarousel from "@/components/HeroCarousel";

// The four countries the guides cover — shown as "Featured Destinations".
// This is intentionally separate from the full (dynamic) category list,
// since topic tags like "Food & Drink" or "Culture" aren't destinations.
const FEATURED_DESTINATIONS = [
  { slug: "italy", label: "Italy", image: "/images/destinations/italy.jpg" },
  { slug: "france", label: "France", image: "/images/destinations/france.jpg" },
  { slug: "switzerland", label: "Switzerland", image: "/images/destinations/switzerland.jpg" },
  { slug: "spain", label: "Spain", image: "/images/destinations/spain.jpg" },
];

// Hero carousel slides, in upload order. Each photo was color-graded to
// match the site's palette (see public/images/hero/ — processed from the
// originals for a consistent, editorial look across very different source
// photos). Add more here the same way if you source additional shots.
const HERO_SLIDES = [
  {
    src: "/images/hero/eiffel-tower-paris-seine-sunset.jpg",
    alt: "The Eiffel Tower reflected in the Seine at sunset, Paris, France",
    location: "France · Paris",
  },
  {
    src: "/images/hero/cevennes-line-train-viaduct-france.jpg",
    alt: "A red regional train crossing a stone viaduct on the Cévennes line, southern France",
    location: "France · Cévennes",
  },
  {
    src: "/images/hero/alhambra-granada-sierra-nevada-spain.jpg",
    alt: "The Alhambra palace and fortress in Granada at sunset, with the snow-capped Sierra Nevada mountains behind, Spain",
    location: "Spain · Granada",
  },
  {
    src: "/images/hero/switzerland-alpine-lake-train.jpg",
    alt: "A red Rhaetian Railway train winding beside a turquoise alpine lake in the Swiss Alps",
    location: "Switzerland · Graubünden",
  },
  {
    src: "/images/hero/venice-grand-canal-sunset-italy.jpg",
    alt: "Sunset over Venice's Grand Canal with gondolas and the dome of Santa Maria della Salute, Italy",
    location: "Italy · Venice",
  },
  {
    src: "/images/hero/bernina-express-landwasser-viaduct-switzerland.jpg",
    alt: "The Bernina Express crossing the Landwasser Viaduct through the Swiss Alps in autumn",
    location: "Switzerland · Bernina Express",
  },
];

export default async function HomePage() {
  const [books, posts, authors, categoryLabels] = await Promise.all([
    getBooks(),
    getPosts(),
    getAuthors(),
    getCategoryLabelMap(),
  ]);

  const journeyPosts = posts.slice(0, 6);
  const storyPosts = posts.slice(0, 3);

  const bookOrder = [
    "Touring Italy by Train",
    "Touring France by Train",
    "Touring Switzerland by Train",
    "Touring Spain by Train",
  ];

  const orderedBooks = [...books].sort(
    (a, b) => bookOrder.indexOf(a.title) - bookOrder.indexOf(b.title),
  );

  return (
    <div>
      {/* Hero */}
      <section className="relative flex h-[72vh] max-h-[640px] min-h-[460px] items-end overflow-hidden">
        <HeroCarousel slides={HERO_SLIDES} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/10" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16">
          <p className="eyebrow text-paper/70">
            Explore Europe by Rail
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight text-paper md:text-6xl">
            <span className="block">Travel Europe</span>
            <span className="block accent-italic">Independently</span>
            <span className="block">With Confidence</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-paper/75">
            Discover authentic rail journeys, insider knowledge and practical
            travel guides designed for independent travellers.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/books"
              className="rounded-md bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper-raised"
            >
              Explore our guides
            </Link>
            <Link
              href="/journeysbyrail"
              className="rounded-md border border-paper/40 px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-paper/10"
            >
              Explore our Journeys
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* Featured guides */}
        <section className="py-16 md:py-24">
          <p className="eyebrow text-clay-dark">The library of discovery</p>
          <div className="mt-3 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold text-pine">
              Featured travel guides
            </h2>
            <Link href="/books" className="hidden text-sm text-moss hover:underline md:block">
              View all guides
            </Link>
          </div>
          <p className="mt-2 max-w-lg text-sm text-stone">
            Built on local expertise and years of independent travel, our guides
            bring together carefully researched rail itineraries, practical advice
            and authentic experiences to help you discover more of Europe.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {orderedBooks.map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </section>
      </div>

      {/* Expertise — dark section */}
      <section className="bg-ink py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="eyebrow text-paper/50">Why Real Travel Guides</p>
          <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold leading-tight text-paper">
            Expertise behind every guide
          </h2>
          <p className="mt-3 max-w-lg text-sm text-paper/60">
            We bring together specialist expertise, local insight and practical
            planning to make independent rail travel simpler — giving you the
            confidence to explore Europe your way.
          </p>
          <div className="mt-10 grid gap-x-8 gap-y-8 rounded-md border border-ink-border bg-ink-raised p-8 sm:grid-cols-2 md:grid-cols-3">
            {[
              {
                title: "Independent travel specialists",
                body: "Created by experienced travel professionals and rail specialists who simplify the planning and help you shape a journey around your time and interests.",
              },
              {
                title: "Local insider knowledge",
                body: "Discover must-see highlights alongside local favourites, hidden gems and authentic experiences that connect you more deeply with the places you visit.",
              },
              {
                title: "Flexible rail itineraries",
                body: "Recommended 5, 7, 10 and 14+ day routes, with the best bases, realistic time in each place and easy day trips and onward journeys by rail.",
              },
              {
                title: "Everything planned, your way",
                body: "Know where to stay, what to see and do, and what needs booking ahead — from trains to popular attractions — then tailor the journey to suit you.",
              },
              {
                title: "Smarter rail travel, better value",
                body: "Practical train advice, booking tips and travel hacks — from tickets and rail passes to reservations and cheaper fares — helping you travel confidently and get more for your money.",
              },
              {
                title: "Travel freely, travel sustainably",
                body: "Skip restrictive tours and stressful car hire. Explore independently by rail, at your own pace, for a more authentic and sustainable way to travel.",
              },
            ].map((f) => (
              <div key={f.title}>
                <p className="font-display text-base font-semibold text-paper">
                  {f.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* Popular rail journeys */}
        <section className="py-16 md:py-24">
          <p className="eyebrow text-clay-dark">Route chronology</p>
          <div className="mt-3 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold text-pine">
              Popular rail journeys
            </h2>
            <Link
              href="/journeysbyrail"
              className="hidden text-sm text-moss hover:underline md:block"
            >
              View all journeys
            </Link>
          </div>
          <p className="mt-2 max-w-lg text-sm text-stone">
            Hand-picked scenic routes across the continent, each mapped,
            timed, and travelled by our authors.
          </p>
          <div className="mt-10 -mx-6 flex gap-6 overflow-x-auto px-6 pb-4 [scrollbar-width:thin]">
            {journeyPosts.map((post) => (
              <JourneyCard
                key={post.slug}
                post={post}
                categoryLabel={categoryLabels[post.categories[0]]}
              />
            ))}
          </div>
        </section>

        {/* Featured destinations */}
        <section className="border-t border-border-line py-16 md:py-24">
          <p className="eyebrow text-clay-dark">Where we&apos;ll take you</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-pine">
            Featured destinations
          </h2>
          <p className="mt-2 max-w-lg text-sm text-stone">
            Four countries, endless possibilities. Discover inspiring rail
            journeys, unforgettable places and new ways to explore Europe.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {FEATURED_DESTINATIONS.map((d) => (
              <DestinationCard
                key={d.slug}
                slug={d.slug}
                label={d.label}
                image={d.image}
              />
            ))}
          </div>
        </section>

        {/* Stories */}
        <section className="border-t border-border-line py-16 md:py-24">
          <p className="eyebrow text-clay-dark">Travel inspiration</p>
          <div className="mt-3 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold text-pine">
              Stories from the slow road
            </h2>
            <Link
              href="/journeysbyrail"
              className="hidden text-sm text-moss hover:underline md:block"
            >
              Read the journal
            </Link>
          </div>
          <div className="mt-10 grid gap-10 sm:grid-cols-2 md:grid-cols-3">
            {storyPosts.map((post) => (
              <PostCard
                key={post.slug}
                post={post}
                categoryLabel={categoryLabels[post.categories[0]]}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Authors — dark section */}
      <section className="bg-ink py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="eyebrow text-paper/50">The People Behind the Guides</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-paper">
            Meet Our Travel Experts
          </h2>
          <p className="mt-2 max-w-lg text-sm text-paper/60">
            Written by experienced travel professionals and shaped by local
            expertise, every guide combines practical rail knowledge with genuine
            insight into the places you&apos;ll explore.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-8">
            {authors.map((author) => (
              <AuthorCard key={author.slug} author={author} />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA — dark section */}
      <section className="bg-ink-raised py-16 md:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <p className="eyebrow justify-center text-paper/50">
            Stay in the loop
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-paper">
            Keep abreast of new guides &amp; stories
          </h2>
          <p className="mt-2 text-sm text-paper/60">
            New routes, honest travel notes, and the occasional discount on
            our guides — no spam, unsubscribe whenever.
          </p>
          <div className="mt-8">
            <Newsletter variant="dark" />
          </div>
        </div>
      </section>
    </div>
  );
}
