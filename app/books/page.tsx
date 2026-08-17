import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { getBooks, getAuthors } from "@/lib/queries";
import Newsletter from "@/components/Newsletter";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Books",
  description:
    "Independent, self-guided rail travel guides for Italy, Switzerland, Spain and France — written by local experts, for sustainable and confident exploration.",
};

export default async function BooksPage() {
  const [books, authors] = await Promise.all([getBooks(), getAuthors()]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-pine md:text-4xl">
        Touring by train
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone">
        Four guides, four countries, one philosophy: independent, sustainable
        travel by rail — with the confidence that comes from real local
        expertise.
      </p>

      <div className="mt-14 space-y-20">
        {books.map((book) => {
          const author = authors.find((a) => a.slug === book.author_slug);
          return (
            <article
              key={book.slug}
              className="grid gap-8 border-t border-border-line pt-12 md:grid-cols-[280px_1fr]"
            >
              <a
                href={book.amazon_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block aspect-[3/4.4] w-full overflow-hidden rounded-md border border-border-line"
              >
                <Image
                  src={book.cover}
                  alt={`${book.title} book cover`}
                  fill
                  className="object-cover"
                />
              </a>
              <div>
                <h2 className="font-display text-2xl font-semibold text-pine">
                  {book.title}
                </h2>
                {author && (
                  <Link
                    href={`/${author.slug}`}
                    className="mt-1 inline-block text-sm text-moss hover:underline"
                  >
                    By {author.name}
                  </Link>
                )}
                <p className="mt-4 text-sm font-medium text-pine">
                  {book.tagline}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone">
                  {book.description}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {book.highlights.map((h) => (
                    <li
                      key={h}
                      className="route-line text-sm text-stone"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
                <a
                  href={book.amazon_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block rounded-md bg-clay px-6 py-3 text-sm font-medium uppercase tracking-wide text-paper transition-colors hover:bg-clay-dark"
                >
                  Buy on Amazon
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-20">
        <Newsletter />
      </div>
    </div>
  );
}
