import Image from "next/image";
import Link from "next/link";
import { Post } from "@/lib/types";

export default function PostCard({
  post,
  categoryLabel,
}: {
  post: Post;
  categoryLabel?: string;
}) {
  const label = categoryLabel ?? post.categories[0];

  return (
    // Same Unicode-normalization issue fixed in getPost() and
    // generateStaticParams: the DB's raw slug and the pre-built static
    // route may be in different Unicode forms (composed vs. decomposed
    // accented characters) even though they look identical. Normalizing
    // here ensures this link always points at the exact form Next.js
    // actually built a page for.
    <Link href={`/post/${post.slug.normalize("NFC")}`} className="group block">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border-line bg-paper-raised">
        <Image
          src={post.cover}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="mt-3">
        <div className="route-line text-xs font-medium uppercase tracking-wide text-clay-dark">
          {label}
          {post.categories.length > 1 && ` +${post.categories.length - 1}`}
        </div>
        <h3 className="mt-1 font-display text-base font-semibold leading-snug text-pine">
          {post.title}
        </h3>
        <p className="mt-1 text-xs text-stone-light">
          {post.read_minutes} min read
        </p>
      </div>
    </Link>
  );
}
