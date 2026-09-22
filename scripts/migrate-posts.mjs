/**
 * Migrates all blog posts from the live Wix site into Supabase.
 *
 * Why two sources: Wix's RSS feed (blog-feed.xml) only lists the ~20 most
 * recent posts, but the sitemap (blog-posts-sitemap.xml) lists every post
 * Wix knows about, since sitemaps are built for search engines to find
 * everything. So:
 *
 *   1. The sitemap gives the complete list of post URLs (all ~186).
 *   2. For posts that also appear in the RSS feed, we use RSS for rich
 *      metadata (categories, cover image, excerpt) — it's the best source
 *      when available.
 *   3. For posts NOT in the RSS feed (the older ones), metadata is pulled
 *      from that page's own tags: category tags on the page itself (links
 *      to /journeysbyrail/categories/...) are the primary source, since
 *      that's the site's own real classification. JSON-LD structured data
 *      is a secondary fallback if present. If neither yields anything, the
 *      post falls back to "Hidden Places" and its slug is listed at the end
 *      under "needs manual category review" — a quick pass in Supabase's
 *      Table Editor fixes those.
 *   4. Either way, the full article body comes from Readability (Firefox's
 *      Reader Mode engine) run against the live page — this works
 *      regardless of Wix's exact markup.
 *   5. Cover images are uploaded to the "post-images" bucket in Supabase
 *      Storage (not committed into the repo), and everything is upserted
 *      into Supabase's posts table.
 *
 * Setup:
 *   npm install
 *   npm install sharp   (if not already a dependency — used to resize/
 *                         compress cover images before upload)
 *   Create a .env.local file in the project root with:
 *     NEXT_PUBLIC_SUPABASE_URL=...
 *     SUPABASE_SERVICE_ROLE_KEY=...
 *   (Supabase -> Project Settings -> API. Use the service_role secret, not
 *   the anon key, since this writes to the DB directly, bypassing the
 *   public read-only RLS policies. Never put this key in the app itself.)
 *
 * Usage:
 *   node scripts/migrate-posts.mjs --limit=5 --dry-run   # test on 5 posts first
 *   node scripts/migrate-posts.mjs                       # full run, all posts
 *   node scripts/migrate-posts.mjs --slug=some-post-slug --dry-run   # debug one post
 *   node scripts/migrate-posts.mjs --slug=slug-a --slug=slug-b       # re-run just these
 */

import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });

const purifyWindow = new JSDOM("").window;
const purify = DOMPurify(purifyWindow);

const SITE = "https://www.realtravelguides.com";
const RSS_URL = `${SITE}/blog-feed.xml`;
const SITEMAP_INDEX_URL = `${SITE}/sitemap.xml`;

// Cover images now go to Supabase Storage instead of public/images/posts —
// committing ~170 binary images into git history was the main cause of the
// repo bloating to ~2 GB and slowing every Vercel build's git clone step.
// Create this bucket once in the Supabase dashboard (Storage -> New bucket),
// name it exactly this, and mark it Public.
const POST_IMAGES_BUCKET = "post-images";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const slugArgs = args
  .filter((a) => a.startsWith("--slug="))
  .map((a) => a.slice("--slug=".length));

const xmlParser = new XMLParser({ ignoreAttributes: false });

// Same slug derivation as lib/types.ts's slugifyCategory — kept duplicated
// here since this script runs standalone via plain `node`, not through
// Next's module resolution. Keep the two in sync if you change either.
function slugifyCategory(label) {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function slugFromLink(link) {
  const raw = link.split("/post/")[1] ?? "";
  return decodeURIComponent(raw);
}

function slugifyImageName(slug) {
  return slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 80);
}

// Recursively walks a sitemap: if it's an index, follows each <sitemap><loc>;
// if it's a leaf urlset, returns every <url><loc> that points to a /post/.
async function fetchAllPostSlugs(sitemapUrl, seen = new Set()) {
  const res = await fetch(sitemapUrl);
  if (!res.ok) throw new Error(`Sitemap fetch failed (${res.status}): ${sitemapUrl}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);

  if (parsed.sitemapindex) {
    const entries = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    for (const entry of entries) {
      await fetchAllPostSlugs(entry.loc, seen);
    }
  } else if (parsed.urlset) {
    const entries = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url];
    for (const entry of entries) {
      if (entry.loc && entry.loc.includes("/post/")) {
        seen.add(slugFromLink(entry.loc));
      }
    }
  }
  return seen;
}

async function fetchRssItems() {
  const res = await fetch(RSS_URL);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const items = parsed.rss.channel.item;
  return Array.isArray(items) ? items : [items];
}

function getMetaContent(document, ...names) {
  for (const name of names) {
    const el =
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name}"]`);
    if (el) return el.getAttribute("content");
  }
  return null;
}

// Best-effort category extraction from a page's own JSON-LD structured data.
// Used as a secondary fallback — see getCategoryLinksFromPage for the
// primary one.
function getJsonLdCategories(document) {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const section = item.articleSection;
        if (section) return Array.isArray(section) ? section : [section];
        if (item.keywords) {
          return String(item.keywords).split(",").map((k) => k.trim());
        }
      }
    } catch {
      // not valid JSON-LD, skip
    }
  }
  return [];
}

// Primary category source for posts outside the RSS window: each post page
// renders its own assigned categories in a footer list marked
// aria-label="Post categories" — that's the ONLY place to look. The site's
// header navigation also links to every category (as a sitewide browse
// menu), and matches the same /categories/ URL pattern, so an unscoped
// a[href*="/categories/"] search picks up all 8 site categories from the
// nav instead of the 1-2 actually assigned to this post. Readability
// strips the real tag list too (as "not article content"), so this reads
// straight from the raw page HTML rather than Readability's output.
// Returns canonical slugs directly (no slugifyCategory needed, since these
// ARE the live site's real slugs).
function getCategoryLinksFromPage(document) {
  const container = document.querySelector('ul[aria-label="Post categories"]');
  const links = container ? container.querySelectorAll('a[href*="/categories/"]') : [];
  const slugs = new Set();
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const match = href.match(/\/categories\/([^/?#]+)/);
    if (match) slugs.add(decodeURIComponent(match[1]).toLowerCase());
  }
  return Array.from(slugs);
}

// Wix media URLs look like:
//   .../media/{id}~mv2.jpg/v1/fill/w_147,h_83,...,blur_2,enc_avif,.../file.jpg
// The /v1/... suffix requests a specific rendition — often a small, blurred
// lazy-load placeholder (note "blur_2" above). Stripping it down to the base
// asset URL gets the original, full-quality upload instead.
function normalizeWixImageUrl(url) {
  if (!url) return url;
  const match = url.match(/(https:\/\/static\.wixstatic\.com\/media\/[^/]+~mv2\.\w+)/i);
  return match ? match[1] : url;
}

// Wix's lazy-loading can put the real image URL in data-src or srcset rather
// than src (which may hold a tiny blurred placeholder). Prefers those, then
// normalizes whatever URL is chosen to the full-resolution original.
function getBestImageSrc(img) {
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset");
  let fromSrcset = null;
  if (srcset) {
    const entries = srcset
      .split(",")
      .map((s) => s.trim().split(/\s+/))
      .filter((e) => e[0]);
    entries.sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0));
    fromSrcset = entries[0]?.[0];
  }
  const candidate =
    fromSrcset || img.getAttribute("data-src") || img.getAttribute("src");
  return normalizeWixImageUrl(candidate);
}

// Rewrites every remaining <img> in the article body to its full-resolution
// source, fixing Wix's blurred lazy-load placeholders.
function upgradeInlineImages(document) {
  const imgs = document.querySelectorAll("img");
  for (const img of imgs) {
    const best = getBestImageSrc(img);
    if (best) img.setAttribute("src", best);
    img.removeAttribute("srcset");
    img.removeAttribute("data-src");
    img.removeAttribute("data-srcset");
  }
}

// Wix typically repeats the post's featured image as the first image inside
// the article body — but our page already shows that same image separately
// as the cover, above the body. Strip just that first image so it isn't
// duplicated.
function stripLeadImage(document) {
  const firstImg = document.querySelector("img");
  if (firstImg) {
    const figure = firstImg.closest("figure");
    (figure ?? firstImg).remove();
  }
}

const DATE_RE =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}$/i;
const MIN_READ_RE = /^\d+\s+min(?:ute)?s?\s+read$/i;
const UPDATED_RE =
  /^updated:\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}$/i;

function htmlText(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isWixNavList(html) {
  if (/header-navigation/i.test(html)) return true;
  const text = htmlText(html).toLowerCase();
  return (
    text.includes("journeys by rail") &&
    text.includes("switzerland") &&
    text.includes("hidden places")
  );
}

function stripMigratedPostChrome(body) {
  if (!body) return body;
  let html = body.replace(/^\uFEFF/, "").trim();

  const list = html.match(/^<(ul|ol)\b[\s\S]*?<\/\1>/i);
  if (list && isWixNavList(list[0])) {
    html = html.slice(list[0].length).trim();
  }

  while (true) {
    const empty = html.match(/^<(p|div|h[1-6])\b[^>]*>\s*(?:&nbsp;|\s)*<\/\1>/i);
    if (empty) {
      html = html.slice(empty[0].length).trim();
      continue;
    }

    const paragraph = html.match(/^<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!paragraph) break;

    const text = htmlText(paragraph[1]);
    if (
      !text ||
      DATE_RE.test(text) ||
      UPDATED_RE.test(text) ||
      MIN_READ_RE.test(text) ||
      /^search$/i.test(text)
    ) {
      html = html.slice(paragraph[0].length).trim();
      continue;
    }
    break;
  }

  return html;
}

async function fetchAndParsePage(postUrl) {
  const res = await fetch(postUrl);
  if (!res.ok) throw new Error(`Post page fetch failed (${res.status}): ${postUrl}`);
  const html = await res.text();
  const dom = new JSDOM(html, { url: postUrl });
  const document = dom.window.document;

  const reader = new Readability(document.cloneNode(true));
  const article = reader.parse();
  if (!article) throw new Error(`Readability could not parse: ${postUrl}`);

  const contentDom = new JSDOM(`<body>${article.content}</body>`);
  upgradeInlineImages(contentDom.window.document);
  stripLeadImage(contentDom.window.document);
  const bodyHtml = stripMigratedPostChrome(
    purify.sanitize(contentDom.window.document.body.innerHTML, {
      ALLOWED_TAGS: [
        "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "em",
        "a", "img", "figure", "figcaption", "br", "hr",
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "title"],
    })
  );

  return {
    bodyHtml,
    text: article.textContent.trim(),
    ogTitle: getMetaContent(document, "og:title"),
    ogImage: getMetaContent(document, "og:image"),
    publishedTime: getMetaContent(document, "article:published_time"),
    pageCategorySlugs: getCategoryLinksFromPage(document),
    jsonLdCategories: getJsonLdCategories(document),
  };
}

// Wix's original full-resolution uploads (which normalizeWixImageUrl()
// deliberately grabs, bypassing Wix's own thumbnail sizing) are often
// several MB straight from a photographer's source file. Covers get run
// through Vercel's on-the-fly image optimization when served via
// next/image, so oversized originals mainly cost extra Storage space and a
// slower first load — but there's no reason to keep multi-MB files around
// when a resized copy looks identical on screen. 2000px on the long edge is
// comfortably larger than this site's cover ever renders at.
const COVER_MAX_DIMENSION = 2000;
const COVER_JPEG_QUALITY = 80;

// Downloads a cover image, resizes/re-compresses it, and uploads the result
// to Supabase Storage, returning its public URL. `upsert: true` means
// re-running the migration for a post safely overwrites that post's
// existing image in place, rather than accumulating new versions the way
// committing to git did.
async function uploadCoverImage(supabase, url, storagePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const originalBuffer = Buffer.from(await res.arrayBuffer());

  const buffer = await sharp(originalBuffer)
    .resize({
      width: COVER_MAX_DIMENSION,
      height: COVER_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: COVER_JPEG_QUALITY })
    .toBuffer();

  const { error } = await supabase.storage
    .from(POST_IMAGES_BUCKET)
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function estimateReadMinutes(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function main() {
  if (!DRY_RUN) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "Missing credentials. Create a .env.local file in the project root with:\n" +
          "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
          "  SUPABASE_SERVICE_ROLE_KEY=...\n" +
          "(Supabase -> Project Settings -> API for both values.)"
      );
      process.exit(1);
    }
  }

  console.log("Fetching sitemap for the full list of posts...");
  const allSlugs = await fetchAllPostSlugs(SITEMAP_INDEX_URL);
  console.log(`Found ${allSlugs.size} posts in the sitemap.`);

  console.log("Fetching RSS feed for rich metadata on recent posts...");
  const rssItems = await fetchRssItems();
  const rssBySlug = new Map(rssItems.map((item) => [slugFromLink(item.link), item]));
  console.log(`${rssBySlug.size} of those posts have RSS metadata available.\n`);

  const supabase =
    !DRY_RUN &&
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

  const slugs = slugArgs.length > 0
    ? slugArgs.filter((s) => allSlugs.has(s))
    : Array.from(allSlugs).slice(0, LIMIT);

  if (slugArgs.length > 0 && slugs.length === 0) {
    console.error("None of the --slug values were found in the sitemap. Check for typos.");
    process.exit(1);
  }
  let ok = 0;
  const failed = [];
  const needsCategoryReview = [];
  const discoveredCategories = new Map(); // slug -> label

  for (const [i, slug] of slugs.entries()) {
    const postUrl = `${SITE}/post/${encodeURIComponent(slug)}`;
    const rssItem = rssBySlug.get(slug);
    console.log(`[${i + 1}/${slugs.length}] ${slug}${rssItem ? " (RSS)" : " (sitemap only)"}`);

    try {
      const page = await fetchAndParsePage(postUrl);

      let categories;
      if (rssItem) {
        const rawCategories = Array.isArray(rssItem.category)
          ? rssItem.category
          : [rssItem.category].filter(Boolean);
        categories = rawCategories.map((raw) => {
          const label = raw.trim();
          const catSlug = slugifyCategory(label);
          discoveredCategories.set(catSlug, label);
          return catSlug;
        });
      } else if (page.pageCategorySlugs.length > 0) {
        // Already canonical slugs straight from the site's own category
        // links — no label to register, they should match the categories
        // table already seeded from the known 8.
        categories = page.pageCategorySlugs;
      } else if (page.jsonLdCategories.length > 0) {
        categories = page.jsonLdCategories.map((raw) => {
          const label = raw.trim();
          const catSlug = slugifyCategory(label);
          discoveredCategories.set(catSlug, label);
          return catSlug;
        });
      } else {
        categories = [];
      }

      if (categories.length === 0) {
        categories.push("hiddenplaces");
        needsCategoryReview.push(slug);
      }

      const title = (rssItem?.title ?? page.ogTitle ?? slug).trim();
      const excerpt = rssItem
        ? rssItem.description.replace(/\s+/g, " ").trim().slice(0, 200)
        : page.text.slice(0, 200).trim();
      const publishedRaw = rssItem?.pubDate ?? page.publishedTime;
      const published_at = publishedRaw
        ? new Date(publishedRaw).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const imageUrl = normalizeWixImageUrl(
        rssItem?.enclosure?.["@_url"] ?? page.ogImage
      );

      const imageName = `${slugifyImageName(slug)}.jpg`;

      // In a dry run (or if no image was found), fall back to a placeholder
      // path so the logged/printed record still looks sensible.
      let coverPath = `/images/posts/${imageName}`;
      if (!DRY_RUN && imageUrl) {
        coverPath = await uploadCoverImage(supabase, imageUrl, imageName);
      }

      const record = {
        slug,
        title,
        excerpt,
        cover: coverPath,
        categories,
        read_minutes: estimateReadMinutes(page.text),
        published_at,
        body: page.bodyHtml,
      };

      if (DRY_RUN) {
        console.log(
          JSON.stringify({ ...record, body: record.body.slice(0, 200) + "..." }, null, 2)
        );
      } else {
        const { error } = await supabase.from("posts").upsert(record);
        if (error) throw error;
      }

      ok++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failed.push(slug);
    }
  }

  if (!DRY_RUN && discoveredCategories.size > 0) {
    const categoryRows = Array.from(discoveredCategories, ([slug, label]) => ({
      slug,
      label,
    }));
    const { error } = await supabase.from("categories").upsert(categoryRows, {
      onConflict: "slug",
      ignoreDuplicates: true,
    });
    if (error) console.error("Category upsert failed:", error.message);
  }

  console.log(`\nDone. ${ok} succeeded, ${failed.length} failed.`);
  console.log(
    `Categories seen: ${Array.from(discoveredCategories.values()).join(", ") || "none"}`
  );
  if (needsCategoryReview.length) {
    console.log(
      `\n${needsCategoryReview.length} post(s) had no category data available and were tagged "Hidden Places" by default — worth a quick look in Supabase's Table Editor:`
    );
    needsCategoryReview.forEach((s) => console.log(`  - ${s}`));
  }
  if (failed.length) {
    console.log("\nFailed slugs (fix manually or re-run, it's safe to re-run):");
    failed.forEach((s) => console.log(`  - ${s}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
