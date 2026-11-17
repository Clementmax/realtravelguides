/**
 * One-off collector for Stage A. Reads posts.body and the images column,
 * records image srcs, and writes pixel dimensions from file headers.
 * Does not upload, update rows, or change storage metadata.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseFragment } from "parse5";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Missing Supabase URL or key in .env.local");
}

const supabase = createClient(url, key);
const OUT_SUMMARY = path.resolve("scripts/_body-image-summary.json");
const OUT_DIMS = path.resolve("lib/body-image-dimensions.json");

function attrMap(node) {
  const map = {};
  for (const attr of node.attrs || []) map[attr.name] = attr.value;
  return map;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function parentChain(node, parents) {
  const names = [];
  let current = parents.get(node);
  while (current && current.nodeName !== "#document-fragment") {
    names.push(current.nodeName);
    current = parents.get(current);
  }
  return names;
}

function indexParents(root) {
  const parents = new Map();
  walk(root, (node) => {
    for (const child of node.childNodes || []) parents.set(child, node);
  });
  return parents;
}

function decodeSrc(value) {
  return value.replace(/&amp;/g, "&").trim();
}

const { data, error } = await supabase
  .from("posts")
  .select("slug, title, body, images");
if (error) throw new Error(error.message || "posts query failed");

const tagNames = new Map();
const attrNames = new Map();
const images = [];
const srcSet = new Set();

for (const post of data) {
  const body = typeof post.body === "string" ? post.body : "";
  const fragment = parseFragment(body);
  const parents = indexParents(fragment);
  walk(fragment, (node) => {
    if (!node.nodeName || node.nodeName.startsWith("#")) return;
    tagNames.set(node.nodeName, (tagNames.get(node.nodeName) || 0) + 1);
    for (const attr of node.attrs || []) {
      attrNames.set(`${node.nodeName}:${attr.name}`, (attrNames.get(`${node.nodeName}:${attr.name}`) || 0) + 1);
    }
    if (node.nodeName !== "img") return;
    const attrs = attrMap(node);
    const src = decodeSrc(attrs.src || "");
    if (src) srcSet.add(src);
    const chain = parentChain(node, parents);
    images.push({
      slug: post.slug,
      title: post.title,
      src,
      alt: attrs.alt ?? null,
      width: attrs.width || null,
      height: attrs.height || null,
      loading: attrs.loading || null,
      decoding: attrs.decoding || null,
      className: attrs.class || null,
      pinMedia: attrs["data-pin-media"] || null,
      pinUrl: attrs["data-pin-url"] || null,
      parents: chain,
      hasFigcaption: chain.includes("figure"),
    });
  });

  const managed = Array.isArray(post.images) ? post.images : [];
  for (const image of managed) {
    if (!image || typeof image.src !== "string" || !image.src.trim()) continue;
    const src = image.src.trim();
    srcSet.add(src);
    images.push({
      slug: post.slug,
      title: post.title,
      src,
      alt: image.alt ?? "",
      width: null,
      height: null,
      loading: null,
      decoding: null,
      className: null,
      pinMedia: null,
      pinUrl: null,
      parents: ["managed-images-column"],
      caption: typeof image.caption === "string" ? image.caption : "",
    });
  }
}

function isLocal(src) {
  return src.startsWith("/") && !src.startsWith("//");
}

function isGraphic(src) {
  return src.includes("/post-images/graphics/");
}

async function dimensionsFor(src) {
  if (isLocal(src)) {
    const file = path.resolve("public", decodeURIComponent(src).replace(/^\/+/, ""));
    const buffer = await readFile(file);
    const meta = await sharp(buffer).metadata();
    return { width: meta.width, height: meta.height, bytes: buffer.length, source: "local" };
  }
  const response = await fetch(src);
  if (!response.ok) {
    return { error: `HTTP ${response.status}`, source: "remote" };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  return { width: meta.width, height: meta.height, bytes: buffer.length, format: meta.format, source: "remote" };
}

const unique = [...srcSet].sort();
const dims = {};
const failures = [];
let index = 0;
const concurrency = 6;
async function worker() {
  while (index < unique.length) {
    const current = index;
    index += 1;
    const src = unique[current];
    try {
      const result = await dimensionsFor(src);
      if (!result.width || !result.height) {
        failures.push({ src, error: result.error || "missing dimensions" });
      } else {
        dims[src] = { width: result.width, height: result.height };
      }
      if ((current + 1) % 25 === 0 || current + 1 === unique.length) {
        console.log(`measured ${current + 1}/${unique.length}`);
      }
    } catch (err) {
      failures.push({ src, error: err instanceof Error ? err.message : String(err) });
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

const missingOnTag = images.filter(
  (image) =>
    image.parents[0] !== "managed-images-column" &&
    !(image.width && image.height) &&
    !dims[image.src]
);

const summary = {
  posts: data.length,
  imgTags: images.filter((image) => image.parents[0] !== "managed-images-column").length,
  managed: images.filter((image) => image.parents[0] === "managed-images-column").length,
  uniqueSrcs: unique.length,
  measured: Object.keys(dims).length,
  failures,
  missingOnTag: missingOnTag.map((image) => ({ slug: image.slug, src: image.src })),
  graphics: unique.filter(isGraphic),
  local: unique.filter(isLocal),
  tagNames: Object.fromEntries([...tagNames].sort((a, b) => b[1] - a[1])),
  attrNames: Object.fromEntries([...attrNames].sort((a, b) => b[1] - a[1])),
  withPin: images.filter((image) => image.pinMedia || image.pinUrl).length,
  withWidthHeight: images.filter((image) => image.width && image.height).length,
  parentSamples: {},
  articles: data.map((post) => ({
    slug: post.slug,
    title: post.title,
    bodyImgs: images.filter((image) => image.slug === post.slug && image.parents[0] !== "managed-images-column").length,
    managed: images.filter((image) => image.slug === post.slug && image.parents[0] === "managed-images-column").length,
  })),
  linkedOrCaptioned: [],
};

const interesting = images.filter(
  (image) =>
    image.parents.includes("a") ||
    image.parents.includes("figure") ||
    (image.caption && image.caption.trim())
);
const seenSlugs = new Set();
for (const image of interesting) {
  if (seenSlugs.has(image.slug)) continue;
  seenSlugs.add(image.slug);
  summary.linkedOrCaptioned.push({
    slug: image.slug,
    title: image.title,
    parents: image.parents,
    caption: image.caption || null,
    className: image.className,
  });
}

await writeFile(OUT_SUMMARY, JSON.stringify(summary, null, 2));
const orderedDims = Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(OUT_DIMS, `${JSON.stringify(orderedDims, null, 2)}\n`);
console.log(
  JSON.stringify({
    posts: summary.posts,
    uniqueSrcs: summary.uniqueSrcs,
    measured: summary.measured,
    failures: failures.length,
    graphics: summary.graphics.length,
    local: summary.local.length,
    withWidthHeight: summary.withWidthHeight,
    linkedOrCaptioned: summary.linkedOrCaptioned.length,
  })
);
