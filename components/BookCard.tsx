import Image from "next/image";
import { Book } from "@/lib/types";

const BOOK_DESCRIPTIONS: Record<string, string> = {
  "Touring Italy by Train":
    "From Renaissance cities and Tuscan landscapes to Alpine lakes and the Amalfi Coast, discover Italy through flexible, rail-led journeys.",
  "Touring France by Train":
    "From Paris and Provence to Atlantic shores, vineyards and the Riviera, explore the extraordinary diversity of France by rail.",
  "Touring Switzerland by Train":
    "Master Switzerland’s remarkable rail network, from legendary panoramic trains and Alpine passes to lakeside towns and mountain villages.",
  "Touring Spain by Train":
    "From Andalucía and the Mediterranean to the Basque Country and Galicia, discover Spain’s great cities, coastlines and hidden gems by rail.",
};

export default function BookCard({ book }: { book: Book }) {
  const description = BOOK_DESCRIPTIONS[book.title] ?? book.tagline;

  return (
    <div className="flex h-full flex-col">
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

      <div className="mt-3 flex flex-1 flex-col border-t border-dashed border-border-line pt-3">
        <p className="font-display text-sm font-semibold text-pine">
          {book.title}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-stone">
          {description}
        </p>
      </div>

      <a
        href={book.amazon_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block rounded-md bg-clay px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-paper transition-colors hover:bg-clay-dark"
      >
        Buy on Amazon
      </a>
    </div>
  );
}
