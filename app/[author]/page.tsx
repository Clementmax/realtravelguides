import Image from "next/image";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getAuthor, getBooksByAuthor, getAuthors } from "@/lib/queries";
import BookCard from "@/components/BookCard";
import Newsletter from "@/components/Newsletter";

const VALID_SLUGS = ["elenarossetti", "sophiepicot"];

export const revalidate = 60;

export async function generateStaticParams() {
  const authors = await getAuthors();
  return authors.map((a) => ({ author: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ author: string }>;
}): Promise<Metadata> {
  const { author: slug } = await params;
  const author = await getAuthor(slug);
  if (!author) return {};
  return {
    title: author.name,
    description: author.short_bio,
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ author: string }>;
}) {
  const { author: slug } = await params;
  if (!VALID_SLUGS.includes(slug)) notFound();

  const author = await getAuthor(slug);
  if (!author) notFound();

  const books = await getBooksByAuthor(slug);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-border-line">
          <Image
            src={author.photo}
            alt={author.name}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-clay-dark">
            Author
          </p>
          <h1 className="font-display text-3xl font-semibold text-pine">
            {author.name}
          </h1>
        </div>
      </div>

      <div className="mt-10 space-y-4">
        {author.full_bio.map((para, i) => (
          <p key={i} className="text-sm leading-relaxed text-stone">
            {para}
          </p>
        ))}
      </div>

      <p className="mt-6 text-sm text-stone">
        For enquiries, contact {author.name.split(" ")[0]} directly at{" "}
        <a
          href={`mailto:${author.contact_email}`}
          className="text-moss underline underline-offset-2"
        >
          {author.contact_email}
        </a>
      </p>

      {books.length > 0 && (
        <div className="mt-16 border-t border-border-line pt-12">
          <h2 className="font-display text-xl font-semibold text-pine">
            Books by {author.name}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {books.map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-16">
        <Newsletter />
      </div>
    </div>
  );
}
