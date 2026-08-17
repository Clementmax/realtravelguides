import Image from "next/image";
import Link from "next/link";
import { Post } from "@/lib/types";

export default function JourneyCard({
  post,
  categoryLabel,
}: {
  post: Post;
  categoryLabel?: string;
}) {
  const label = categoryLabel ?? post.categories[0];

  return (
    <Link
      href={`/post/${post.slug}`}
      className="group block w-64 shrink-0 md:w-72"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md">
        <Image
          src={post.cover}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-clay-dark">
          {label}
        </p>
        <p className="mt-1 font-display text-base font-semibold leading-snug text-pine">
          {post.title}
        </p>
        <p className="route-line mt-2 text-xs text-stone">
          {post.read_minutes} min read
        </p>
      </div>
    </Link>
  );
}
