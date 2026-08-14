import Image from "next/image";
import Link from "next/link";
import { Post, CATEGORY_LABELS, Category } from "@/lib/types";

export default function PostCard({ post }: { post: Post }) {
  const categoryLabel =
    CATEGORY_LABELS[post.category as Category] ?? post.category;

  return (
    <Link href={`/post/${post.slug}`} className="group block">
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
          {categoryLabel}
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
