import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPost, getPosts, getCategoryLabelMap } from "@/lib/queries";
import Newsletter from "@/components/Newsletter";
import { ManagedPostImage } from "@/lib/types";

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
  return { title: post.title, description: post.excerpt };
}

function normaliseImageRef(value: string) {
  try {
    return decodeURIComponent(value)
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/[?#].*$/, "")
      .replace(/\\/g, "/")
      .trim()
      .toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/[?#].*$/, "")
      .replace(/\\/g, "/")
      .trim()
      .toLowerCase();
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function managedImagesForBody(
  body: string,
  images: ManagedPostImage[] | null | undefined,
  cover: string
) {
  if (!images?.length) return [];

  const bodyRefs = Array.from(
    body.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)
  ).map((m) => normaliseImageRef(m[1]));

  const coverRef = normaliseImageRef(cover);
  const seen = new Set<string>();

  return images.filter((image) => {
    const ref = normaliseImageRef(image.src);
    if (!ref || ref === coverRef || bodyRefs.includes(ref) || seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });
}

function figureHtml(image: ManagedPostImage) {
  const caption = image.caption?.trim()
    ? `<figcaption class="mt-2 text-sm text-stone-light">${escapeHtml(image.caption.trim())}</figcaption>`
    : "";

  return `
    <figure class="rtg-managed-image my-8">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}" loading="lazy" decoding="async" class="h-auto w-full rounded-md" />
      ${caption}
    </figure>
  `;
}

function injectManagedImages(
  body: string,
  images: ManagedPostImage[] | null | undefined,
  cover: string
) {
  const managed = managedImagesForBody(body, images, cover).slice(0, 3);
  if (!managed.length || !/<[a-z][\s\S]*>/i.test(body)) return body;

  const positions: number[] = [];
  const paragraphEnd = /<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = paragraphEnd.exec(body)) !== null) positions.push(match.index + match[0].length);
  if (!positions.length) return body;

  const targets = managed.length === 1 ? [0.5] : managed.length === 2 ? [0.38, 0.72] : [0.3, 0.56, 0.8];
  const insertions = managed.map((image, index) => ({
    position: positions[Math.min(positions.length - 1, Math.max(0, Math.round((positions.length - 1) * targets[index])))],
    figure: figureHtml(image),
  }));

  let result = body;
  for (const insertion of [...insertions].sort((a, b) => b.position - a.position)) {
    result = result.slice(0, insertion.position) + insertion.figure + result.slice(insertion.position);
  }
  return result;
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const categoryLabels = await getCategoryLabelMap();
  const renderedBody = injectManagedImages(post.body, post.images, post.cover);
  const managedForPlainText = managedImagesForBody(post.body, post.images, post.cover).slice(0, 3);

  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-wrap gap-3">
        {post.categories.map((c) => (
          <Link key={c} href={`/journeysbyrail/categories/${c}`} className="route-line text-xs font-medium uppercase tracking-wide text-clay-dark hover:underline">
            {categoryLabels[c] ?? c}
          </Link>
        ))}
      </div>

      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-pine md:text-4xl">{post.title}</h1>
      <p className="mt-3 text-sm text-stone-light">{post.read_minutes} min read</p>

      {post.video_url ? (
        <div className="mt-8 overflow-hidden rounded-md border border-border-line bg-ink">
          <video controls playsInline preload="metadata" className="aspect-video w-full bg-black">
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
        {/<[a-z][\s\S]*>/i.test(post.body) ? (
          <div dangerouslySetInnerHTML={{ __html: renderedBody }} />
        ) : (
          post.body.split("\n\n").map((para, i, paras) => {
            const targets = managedForPlainText.length === 1 ? [Math.round(paras.length * 0.5)]
              : managedForPlainText.length === 2 ? [Math.round(paras.length * 0.38), Math.round(paras.length * 0.72)]
              : [Math.round(paras.length * 0.3), Math.round(paras.length * 0.56), Math.round(paras.length * 0.8)];
            const imageIndex = targets.indexOf(i + 1);
            const image = imageIndex >= 0 ? managedForPlainText[imageIndex] : undefined;

            return (
              <div key={i}>
                <p>{para}</p>
                {image ? (
                  <figure className="my-8">
                    <img src={image.src} alt={image.alt || ""} loading="lazy" decoding="async" className="h-auto w-full rounded-md" />
                    {image.caption ? <figcaption className="mt-2 text-sm text-stone-light">{image.caption}</figcaption> : null}
                  </figure>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-16"><Newsletter /></div>
    </article>
  );
}
