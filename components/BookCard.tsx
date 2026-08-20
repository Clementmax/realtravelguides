import Image from "next/image";
import { Book } from "@/lib/types";

const BOOK_DESCRIPTIONS: Record<string, string> = {
  italy:
    "From Renaissance cities and Tuscan landscapes to Alpine lakes and the Amalfi Coast, discover Italy through flexible, rail-led journeys.",
  france:
    "From Paris and Provence to Atlantic shores, vineyards and the Riviera, explore the extraordinary diversity of France by rail.",
  switzerland:
    "Master Switzerland’s remarkable rail network, from legendary panoramic trains and Alpine passes to lakeside towns and mountain villages.",
  spain:
    "From Andalucía and the Mediterranean to the Basque Country and Galicia, discover Spain’s great cities, coastlines and hidden gems by rail.",
};

export default function BookCard({ book }: { book: Book }) {
  return (
    <div className="flex flex-col">
      <a
        href={book.amazon_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-md border border-border-line bg-paper-raised"
      >
        <div className="relative aspect-[3/4.4] w-full">
          <Image
            src={book.cover}
            alt={`${book.title} book cover`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </a>
      <div className="ticket-edge mt-3 border-t border-dashed border-border-line pt-3">
        <div>
          <p className="font-display text-sm font-semibold text-pine">
            {book.title}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone">
            {BOOK_DESCRIPTIONS[book.slug] ?? book.tagline}
          </p>
        </div>
      </div>
      <a
        href={book.amazon_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-md bg-clay px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-paper transition-colors hover:bg-clay-dark"
      >
        Buy on Amazon
      </a>
    </div>
  );
}
