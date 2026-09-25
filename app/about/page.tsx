import type { Metadata } from "next";
import Image from "next/image";
import TravelExperts from "@/components/TravelExperts";

const ABOUT_TITLE = "About Real Travel Guides | Independent Rail Travel Experts";
const ABOUT_DESCRIPTION =
  "Meet the people behind Real Travel Guides and discover why we create practical, locally informed guides for independent rail travel across Europe.";

export const metadata: Metadata = {
  title: {
    absolute: ABOUT_TITLE,
  },
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    url: "/about",
    type: "website",
    images: [{ url: "/images/logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    images: ["/images/logo.png"],
  },
};

export default function AboutPage() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow text-clay-dark">The story behind the guides</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-pine md:text-4xl">
            Why Real Travel Guides
          </h1>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-stone">
            <p>
              There is something special about discovering Europe by train. The
              drama of an Alpine crossing, a railway tracing the Mediterranean
              coast, an overnight journey that wakes in another country, or
              simply watching the landscape change outside the window. The
              journey becomes part of the experience rather than the time
              between places.
            </p>
            <p>
              Rail also encourages a different kind of travel. Slower, perhaps,
              but richer and more spontaneous — with time to explore smaller
              places, stay longer, make a detour and experience more of the
              character of a country. And choosing rail and public transport
              allows us to travel more lightly, without sacrificing the freedom
              or sense of adventure that makes a great journey memorable.
            </p>
          </div>
          <figure className="group my-8 md:my-10">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md">
              <Image
                src="/images/authors/carolyn-storme.jpg"
                alt="Carolyn Storme"
                fill
                sizes="(min-width: 672px) 672px, 100vw"
                className="object-cover object-center grayscale transition-all duration-500 group-hover:grayscale-0"
              />
            </div>
          </figure>
          <h2 className="font-display text-2xl font-semibold text-pine">
            Our mission
          </h2>
          <p className="mt-3 font-display text-lg italic leading-relaxed text-pine">
            Real Travel Guides exists to make independent rail travel easier,
            more rewarding and more accessible — giving you the confidence to
            explore Europe your own way.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-stone">
            <p>
              We take on the research that can make independent travel
              complicated: working out the best routes and bases, realistic
              timings, worthwhile day trips, scenic journeys, reservations and
              the things worth knowing before you go. Our guides combine that
              practical detail with local expertise and first-hand experience,
              helping you get beyond the obvious as well as make the most of
              the places you came to see.
            </p>
            <p>
              Follow one of our suggested itineraries exactly, adapt it around
              your own interests, or use the ideas, practical advice and
              planning tools throughout the guide to build a journey entirely
              your own. Rail leads the journey, with boats, buses, cycling and
              walking opening up even more possibilities along the way.
            </p>
          </div>
          <p className="mt-8 font-display text-base italic text-pine">
            We do the planning. You make the journey your own.
          </p>
          <p className="mt-8 font-display text-lg font-semibold text-pine">
            Carolyn Storme
          </p>
          <p className="mt-1 text-sm text-stone">
            Founder and Publisher, Real Travel Guides
          </p>
        </div>
      </section>

      <TravelExperts />
    </div>
  );
}
