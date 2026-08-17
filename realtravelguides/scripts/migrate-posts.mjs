/**
 * Migrates all blog posts from the live Wix site into Supabase.
 *
 * What it does:
 *   1. Fetches the RSS feed for metadata (title, slug, categories, date, cover image, excerpt).
 *      The RSS description is truncated, so it's used as `excerpt` only.
 *   2. For each post, fetches the live `/post/[slug]` page and extracts the full
 *      article body using Readability (the Firefox Reader Mode engine) — this
 *      works regardless of Wix's exact markup, since it identifies the main
 *      article content generically rather than relying on specific selectors.
 *   3. Downloads each post's cover image into public/images/posts/.
 *   4. Upserts everything into the `posts` table in Supabase.
 *
 * Setup:
 *   npm install --save-dev fast-xml-parser jsdom @mozilla/readability dotenv
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-posts.mjs           # full run
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate-posts.mjs --limit=5 --dry-run
 *
 * The service role key (not the anon key) is required because this writes to
 * the database directly, bypassing the public read-only RLS policies. Find it
 * in Supabase: Project Settings -> API -> service_role secret. Never expose
 * this key in the app itself — it's only used here, locally, once.
 */

import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const SITE = "https://www.realtravelguides.com";
const RSS_URL = `${SITE}/blog-feed.xml`;
const IMAGES_DIR = path.join(process.cwd(), "public", "images", "posts");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

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
  return slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80);
}

async function fetchRssItems() {
  const res = await fetch(RSS_URL);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const items = parsed.rss.channel.item;
  return Array.isArray(items) ? items : [items];
}

async function fetchArticleBody(postUrl) {
  const res = await fetch(postUrl);
  if (!res.ok) throw new Error(`Post page fetch failed (${res.status}): ${postUrl}`);
  const html = await res.text();
  const dom = new JSDOM(html, { url: postUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) throw new Error(`Readability could not parse: ${postUrl}`);
  return { html: article.content, text: article.textContent.trim() };
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
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  console.log("Fetching RSS feed...");
  const items = await fetchRssItems();
  console.log(`Found ${items.length} posts in the feed.`);

  const supabase =
    !DRY_RUN &&
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

  let ok = 0;
  let failed = [];
  const discoveredCategories = new Map(); // slug -> label

  for (const [i, item] of items.slice(0, LIMIT).entries()) {
    const slug = slugFromLink(item.link);
    const postUrl = `${SITE}/post/${encodeURIComponent(slug)}`;
    console.log(`[${i + 1}/${Math.min(items.length, LIMIT)}] ${slug}`);

    try {
      const { text } = await fetchArticleBody(postUrl);

      const rawCategories = Array.isArray(item.category)
        ? item.category
        : [item.category].filter(Boolean);
      const categories = rawCategories.map((raw) => {
        const label = raw.trim();
        const catSlug = slugifyCategory(label);
        discoveredCategories.set(catSlug, label);
        return catSlug;
      });
      if (categories.length === 0) categories.push("hiddenplaces");

      const imageUrl = item.enclosure?.["@_url"];
      const imageName = `${slugifyImageName(slug)}.jpg`;
      const imageDest = path.join(IMAGES_DIR, imageName);
      const coverPath = `/images/posts/${imageName}`;

      if (!DRY_RUN && imageUrl) {
        await downloadImage(imageUrl, imageDest);
      }

      const record = {
        slug,
        title: item.title.trim(),
        excerpt: item.description.replace(/\s+/g, " ").trim().slice(0, 200),
        cover: coverPath,
        categories,
        read_minutes: estimateReadMinutes(text),
        published_at: new Date(item.pubDate).toISOString().slice(0, 10),
        body: text,
      };

      if (DRY_RUN) {
        console.log(JSON.stringify({ ...record, body: record.body.slice(0, 120) + "..." }, null, 2));
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
    `Categories seen: ${Array.from(discoveredCategories.values()).join(", ")}`
  );
  if (failed.length) {
    console.log("Failed slugs (fix manually or re-run):");
    failed.forEach((s) => console.log(`  - ${s}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
