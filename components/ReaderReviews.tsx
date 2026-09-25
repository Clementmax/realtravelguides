"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Review = {
  id: string;
  quote: string;
  book: string;
  attribution: string;
  href: string;
};

const REVIEWS: Review[] = [
  {
    id: "italy-1",
    quote:
      "“As a first-time traveler to Italy, this book gave me the confidence to use the trains without hesitation.”",
    book: "Touring Italy by Train",
    attribution: "Amazon Verified Purchase · USA",
    href: "https://mybook.to/TouringItalybyTrain",
  },
  {
    id: "italy-2",
    quote:
      "“I’ve done the guided tour thing before, but this time I wanted more freedom and this book gave me exactly that.”",
    book: "Touring Italy by Train",
    attribution: "Amazon Verified Purchase · USA",
    href: "https://mybook.to/TouringItalybyTrain",
  },
  {
    id: "france-1",
    quote:
      "“The sample ideas helped in decision making and the itineraries are easy to follow. I loved the practical advice on booking trains, navigating the rail system, and discovering destinations beyond the typical tourist attractions.”",
    book: "Touring France by Train",
    attribution: "Amazon Verified Purchase · USA",
    href: "https://mybook.to/TouringFranceByTrain",
  },
  {
    id: "france-2",
    quote:
      "“It reads like advice from someone who’s actually done it, not a brochure. Great for first-timers in France or anyone who wants simple, train-friendly routes without overplanning.”",
    book: "Touring France by Train",
    attribution: "Amazon reader review · USA",
    href: "https://mybook.to/TouringFranceByTrain",
  },
  {
    id: "switzerland-1",
    quote:
      "“This is the best travel book I have ever used. Beautifully written and full of practical and inspirational content. I have based my whole upcoming trip on this book, no need for anything else.”",
    book: "Touring Switzerland by Train",
    attribution: "Amazon Verified Purchase · UK",
    href: "https://mybook.to/SwitzerlandByTrain",
  },
  {
    id: "switzerland-2",
    quote:
      "“What I liked most is that the book gives you both the practical details and the feeling of the trip. It clearly explains rail passes, routes, stations, day trips, and sample itineraries, and it also brings the experience to life with scenic trains, alpine views, lake towns, local food, and Swiss traditions.”",
    book: "Touring Switzerland by Train",
    attribution: "Amazon reader review · USA",
    href: "https://mybook.to/SwitzerlandByTrain",
  },
  {
    id: "spain-1",
    quote:
      "“It feels like a guide written for someone who wants to travel independently but doesn’t want to spend hours piecing together all the logistics from different websites.”",
    book: "Touring Spain by Train",
    attribution: "Amazon Verified Purchase · Germany",
    href: "https://mybook.to/TouringSpainByTrain",
  },
  {
    id: "spain-2",
    quote:
      "“It made Spain feel easier to explore, less stressful, and full of possibilities.”",
    book: "Touring Spain by Train",
    attribution: "Amazon reader review · USA",
    href: "https://mybook.to/TouringSpainByTrain",
  },
];

const ROTATE_MS = 7000;

function Stars() {
  return (
    <div className="flex gap-1 text-brass" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M10 1.6 12.2 6.4l5.2.6-3.8 3.5.9 5.1L10 13.3 5.5 15.6l.9-5.1L2.6 7l5.2-.6L10 1.6Z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewBody({ review, pinMeta }: { review: Review; pinMeta?: boolean }) {
  return (
    <article data-review className="flex h-full flex-col">
      <Stars />
      <p className="sr-only">Five star review</p>
      <blockquote className="mt-5 font-display text-lg italic leading-relaxed text-pine md:text-xl">
        {review.quote}
      </blockquote>
      <div className={pinMeta ? "mt-auto pt-8" : "mt-8"}>
        <a
          href={review.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display text-base font-semibold text-pine underline decoration-border-line underline-offset-4 transition-colors hover:text-moss hover:decoration-moss"
        >
          {review.book}
        </a>
        <p className="mt-2 text-xs tracking-wide text-stone">{review.attribution}</p>
      </div>
    </article>
  );
}

function ReviewCarousel({ perView }: { perView: 1 | 2 }) {
  const pages: Review[][] = [];
  for (let i = 0; i < REVIEWS.length; i += perView) {
    pages.push(REVIEWS.slice(i, i + perView));
  }
  const pageCount = pages.length;

  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [active, setActive] = useState(false);
  const [frameHeight, setFrameHeight] = useState<number>();
  const viewportRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visible = window.matchMedia(perView === 2 ? "(min-width: 768px)" : "(max-width: 767px)");
    const apply = () => {
      setReducedMotion(motion.matches);
      setActive(visible.matches);
    };
    apply();
    motion.addEventListener("change", apply);
    visible.addEventListener("change", apply);
    return () => {
      motion.removeEventListener("change", apply);
      visible.removeEventListener("change", apply);
    };
  }, [perView]);

  useLayoutEffect(() => {
    if (perView !== 1) return;
    const root = viewportRef.current;
    if (!root) return;
    const measure = () => {
      const slide = root.querySelectorAll<HTMLElement>("[data-review-page]")[page];
      const next = slide?.offsetHeight ?? 0;
      if (next > 0) setFrameHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [perView, page]);

  useEffect(() => {
    if (!active || !autoplay || paused || reducedMotion || pageCount <= 1) return;
    const timer = window.setInterval(() => {
      setPage((current) => (current + 1) % pageCount);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [active, autoplay, paused, reducedMotion, pageCount]);

  function show(next: number) {
    setAutoplay(false);
    setPage((next + pageCount) % pageCount);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    startX.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(delta) < 48) return;
    show(page + (delta < 0 ? 1 : -1));
  }

  return (
    <div
      className="mt-10"
      aria-roledescription="carousel"
      aria-label="Reader reviews"
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) setPaused(true);
      }}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setPaused(false);
        }
      }}
    >
      <div
        ref={viewportRef}
        className="overflow-hidden"
        style={{
          touchAction: "pan-y",
          height: perView === 1 ? frameHeight : undefined,
          transition: perView === 1 && !reducedMotion ? "height 700ms" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div
          className="flex items-start ease-out motion-reduce:transition-none"
          style={{
            width: `${pageCount * 100}%`,
            transform: `translateX(-${(page * 100) / pageCount}%)`,
            transition: reducedMotion ? "none" : "transform 700ms",
          }}
        >
          {pages.map((group, pageIndex) => (
            <div
              key={group.map((review) => review.id).join("-")}
              className="shrink-0"
              style={{ width: `${100 / pageCount}%` }}
              data-review-page
              aria-hidden={pageIndex !== page}
              inert={pageIndex !== page}
            >
              <div className={perView === 2 ? "grid grid-cols-2" : "grid grid-cols-1"}>
                {group.map((review, index) => (
                  <div
                    key={review.id}
                    className={
                      perView === 2
                        ? index === 0
                          ? "pr-10 lg:pr-14"
                          : "border-l border-border-line pl-10 lg:pl-14"
                        : undefined
                    }
                  >
                    <ReviewBody review={review} pinMeta={perView === 2} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-center gap-5">
        <button
          type="button"
          aria-label="Previous reviews"
          onClick={() => show(page - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-line text-pine transition-colors hover:border-moss hover:text-moss"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M14.5 6.5 9 12l5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          {pages.map((group, index) => (
            <button
              key={group.map((review) => review.id).join("-")}
              type="button"
              aria-label={
                group.length === 2
                  ? `Show reviews ${index * 2 + 1} and ${index * 2 + 2}`
                  : `Show review ${index + 1}`
              }
              aria-current={index === page ? "true" : undefined}
              onClick={() => show(index)}
              className="flex h-11 w-6 items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  index === page ? "w-5 bg-pine" : "w-2 bg-pine/25"
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Next reviews"
          onClick={() => show(page + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-line text-pine transition-colors hover:border-moss hover:text-moss"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M9.5 6.5 15 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ReaderReviews() {
  return (
    <section className="border-t border-border-line py-16 md:py-24">
      <p className="eyebrow text-clay-dark">Tried, tested &amp; travelled</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-pine">
        What Our Readers Say
      </h2>
      <p className="mt-2 max-w-lg text-sm text-stone">
        From planning the route to experiencing the journey, discover what
        readers are saying about Real Travel Guides.
      </p>
      <div className="md:hidden">
        <ReviewCarousel perView={1} />
      </div>
      <div className="hidden md:block">
        <ReviewCarousel perView={2} />
      </div>
    </section>
  );
}
