import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPost, getPosts } from "@/lib/queries";
import { CATEGORY_LABELS, Category } from "@/lib/types";
import Newsletter from "@/components/Newsletter";

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const categoryLabel = CATEGORY_LABELS[post.category as Category] ?? post.category;

  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/journeysbyrail/categories/${post.category}`}
        className="route-line text-xs font-medium uppercase tracking-wide text-clay-dark hover:underline"
      >
        {categoryLabel}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-pine md:text-4xl">
        {post.title}
      </h1>
      <p className="mt-3 text-sm text-stone-light">
        {post.read_minutes} min read
      </p>

      <div className="relative mt-8 aspect-[16/10] w-full overflow-hidden rounded-md border border-border-line">
        <Image src={post.cover} alt={post.title} fill className="object-cover" />
      </div>

      <div className="prose prose-stone mt-10 max-w-none text-sm leading-relaxed text-pine">
        {post.body.split("\n\n").map((para, i) => (
          <p key={i} className="mb-4">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-16">
        <Newsletter />
      </div>
    </article>
  );
}
