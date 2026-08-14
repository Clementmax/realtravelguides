import Image from "next/image";
import { Book } from "@/lib/types";

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
      <div className="ticket-edge mt-3 flex items-center justify-between border-t border-dashed border-border-line pt-3">
        <div>
          <p className="font-display text-sm font-semibold text-pine">
            {book.title}
          </p>
          <p className="route-line mt-1 text-xs text-stone">
            {book.tagline.length > 46
              ? book.tagline.slice(0, 46) + "…"
              : book.tagline}
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
