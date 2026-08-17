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
 *   5. Cover images are downloaded into public/images/posts/, and
 *      everything is upserted into Supabase.
 *
 * Setup:
 *   npm install
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
 */

import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

dotenv.config({ path: ".env.local" });

const SITE = "https://www.realtravelguides.com";
const RSS_URL = `${SITE}/blog-feed.xml`;
const SITEMAP_INDEX_URL = `${SITE}/sitemap.xml`;
const IMAGES_DIR = path.join(process.cwd(), "public", "images", "posts");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

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

// Primary category source for posts outside the RSS window: Wix blog posts
// typically show clickable category tags right on the page, linking to the
// category archive (e.g. /journeysbyrail/categories/switzerland — the same
// URL structure we preserved from the live site). Readability strips these
// as "not article content" since they're navigation, not prose, but they're
// still present in the raw page HTML. Returns canonical slugs directly
// (no slugifyCategory needed, since these ARE the live site's real slugs).
function getCategoryLinksFromPage(document) {
  const links = document.querySelectorAll('a[href*="/categories/"]');
  const slugs = new Set();
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const match = href.match(/\/categories\/([^/?#]+)/);
    if (match) slugs.add(decodeURIComponent(match[1]).toLowerCase());
  }
  return Array.from(slugs);
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

  return {
    text: article.textContent.trim(),
    ogTitle: getMetaContent(document, "og:title"),
    ogImage: getMetaContent(document, "og:image"),
    publishedTime: getMetaContent(document, "article:published_time"),
    pageCategorySlugs: getCategoryLinksFromPage(document),
    jsonLdCategories: getJsonLdCategories(document),
  };
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
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

  await fs.mkdir(IMAGES_DIR, { recursive: true });

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

  const slugs = Array.from(allSlugs).slice(0, LIMIT);
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
      const imageUrl = rssItem?.enclosure?.["@_url"] ?? page.ogImage;

      const imageName = `${slugifyImageName(slug)}.jpg`;
      const imageDest = path.join(IMAGES_DIR, imageName);
      const coverPath = `/images/posts/${imageName}`;

      if (!DRY_RUN && imageUrl) {
        await downloadImage(imageUrl, imageDest);
      }

      const record = {
        slug,
        title,
        excerpt,
        cover: coverPath,
        categories,
        read_minutes: estimateReadMinutes(page.text),
        published_at,
        body: page.text,
      };

      if (DRY_RUN) {
        console.log(
          JSON.stringify({ ...record, body: record.body.slice(0, 120) + "..." }, null, 2)
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
