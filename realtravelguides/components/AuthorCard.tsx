import Image from "next/image";
import Link from "next/link";
import { Author } from "@/lib/types";

export default function AuthorCard({ author }: { author: Author }) {
  return (
    <Link href={`/${author.slug}`} className="group block">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md">
        <Image
          src={author.photo}
          alt={author.name}
          fill
          className="object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
        />
      </div>
      <p className="mt-4 text-xs uppercase tracking-wide text-paper/50">
        Author
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-paper">
        {author.name}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-paper/60">
        {author.short_bio}
      </p>
      <p className="accent-italic mt-3 text-sm">
        {author.name
          .split(" ")
          .map((w) => w[0])
          .join(". ")}
        .
      </p>
    </Link>
  );
}
