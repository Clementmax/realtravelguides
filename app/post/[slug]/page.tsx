import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPost, getPosts, getCategoryLabelMap } from "@/lib/queries";
import Newsletter from "@/components/Newsletter";

export const revalidate = 60;

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

  const categoryLabels = await getCategoryLabelMap();

  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-wrap gap-3">
        {post.categories.map((c) => (
          <Link
            key={c}
            href={`/journeysbyrail/categories/${c}`}
            className="route-line text-xs font-medium uppercase tracking-wide text-clay-dark hover:underline"
          >
            {categoryLabels[c] ?? c}
          </Link>
        ))}
      </div>
      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-pine md:text-4xl">
        {post.title}
      </h1>
      <p className="mt-3 text-sm text-stone-light">
        {post.read_minutes} min read
      </p>

      {post.video_url ? (
        <div className="mt-8 overflow-hidden rounded-md border border-border-line bg-ink">
          <video
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black"
          >
            <source src={post.video_url} type="video/mp4" />
            Your browser does not support HTML5 video.
          </video>
        </div>
      ) : (
        <div className="relative mt-8 aspect-[16/10] w-full overflow-hidden rounded-md border border-border-line">
          <Image src={post.cover} alt={post.title} fill className="object-cover" />
        </div>
      )}

      <div className="post-content mt-10">
        {/\<[a-z][\s\S]*>/i.test(post.body) ? (
          <div dangerouslySetInnerHTML={{ __html: post.body }} />
        ) : (
          post.body.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
        )}
      </div>

      <div className="mt-16">
        <Newsletter />
      </div>
    </article>
  );
}
