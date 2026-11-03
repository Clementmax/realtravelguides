/**
 * Plans a move of in-article photographs to the public Supabase bucket
 * `post-images`, as WebP, without touching covers or the `images` column.
 *
 * Default is a dry run. It reads `posts.body`, encodes WebP locally, and
 * prints the planned src / data-pin-media replacements. It does not upload
 * and does not write the database unless `--apply` is passed.
 *
 *   node --use-system-ca scripts/migrate-body-images.mjs --slug=<slug> [--slug=<slug> ...]
 *   node --use-system-ca scripts/migrate-body-images.mjs --slug=<slug> --apply
 *
 * `--apply` uploads every optimised image for an article and, only if all of
 * those uploads succeed, updates that article's `body`. This script refuses
 * both steps when `--apply` is absent. Do not pass `--apply` for a dry run.
 * If `--dry-run` and `--apply` are both present, the run stays a dry run.
 *
 * Optimised files are written under a temp directory outside the repo so
 * sizes can be measured, then deleted. Originals are never uploaded.
 *
 * Before any apply, a JSON backup of `{ slug, body }` is written outside the
 * repo when that file is missing (also written on a dry run, as a read-only
 * copy). An existing backup is left untouched so a later apply cannot replace
 * the original body with the migrated HTML:
 *
 *   C:\Users\carol\OneDrive\Documents\rtg-image-migration-backup\<slug>.json
 *
 * Rollback after a future apply:
 *   1. Read that JSON file.
 *   2. Write its `body` back to `posts.body` for that slug.
 *   3. Do not delete the original Wix objects or files in public/images.
 *      The restored HTML still points at them, and those URLs stay valid.
 *   4. Objects under post-images/content/<slug>/ are copies. Deleting them
 *      is optional; the restored body does not need them.
 *
 * Storage (apply only): post-images / content/<article-slug>/<file>.webp
 * Public URL: {SUPABASE_URL}/storage/v1/object/public/post-images/content/<slug>/<file>.webp
 * The filename is a short slug from the alt text (or the original filename)
 * plus a short hash of the source URL. Each article has its own directory,
 * so a photo shared by two articles is not overwritten globally. A rerun of
 * the same source URL keeps the same name.
 *
 * Body images are ordinary <img src="..."> tags. The post page renders `body`
 * as HTML, so the browser fetches the WebP itself. They are not passed
 * through next/image, and Vercel image optimisation is not used. The cover
 * is separate and is left alone.
 *
 * Reads .env.local (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY,
 * or the anon key for a read). Never prints those values.
 */

import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env.local") });

const BUCKET = "post-images";
const BACKUP_DIR = "C:\\Users\\carol\\OneDrive\\Documents\\rtg-image-migration-backup";
const MAX_WIDTH = 1600;
const QUALITY = 80;
const QUALITY_IF_LARGE = 75;
const TARGET_MAX_BYTES = 300 * 1024;
const FLAG_BYTES = 500 * 1024;

// Repeated decorative asset. Alt text is an image-generation prompt and the
// <img> sits outside <figure>. Identified from post HTML, not guessed.
const DECORATIVE_WIX_ID = "fef05b_5ae5d110be0842f4ba199067eec10538";

// Book-cover files identified from article HTML. Several repeats have an
// empty alt, so the media id is the stable check. Alt-text rules below
// still catch a new cover that uses the usual "Touring … by Train" line.
const BOOK_WIX_IDS = [
  "5f33fc_414c70517ef6455f82db193fc8513a1e",
  "5f33fc_d5782bc2f91a4c889bc28da5eb8a8917",
  "5f33fc_db6f5f5f1e2c43f3b9d2c7894f45926e",
  "5f33fc_df33390de29a4579bb2d8b5f4fd3c3ed",
  "5f33fc_abac134a58794f2bae46463fff3768fe",
  "5f33fc_8ad6563fe1fd4ea2b8d15bf5761b6cbb",
  "5f33fc_9b7bed425f034ef58f277d23c0792e2c",
  "5f33fc_5e9bab111d1240de837af0adb60fe99b",
];

function parseArgs(argv) {
  const args = { slugs: [], apply: false, dryRun: false };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--slug=")) args.slugs.push(arg.slice("--slug=".length));
  }
  return args;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function fileStem(alt, src) {
  const fromAlt = slugify(alt).slice(0, 40).replace(/-+$/g, "");
  if (fromAlt.length >= 3) return fromAlt;
  let base = "photo";
  try {
    base = decodeURIComponent(src.split("?")[0].split("/").pop() || "photo");
  } catch {
    base = src.split("?")[0].split("/").pop() || "photo";
  }
  base = base.replace(/\.[a-z0-9]+$/i, "");
  return slugify(base).slice(0, 40).replace(/-+$/g, "") || "photo";
}

function outputFilename(alt, src) {
  return `${fileStem(alt, src)}-${shortHash(src)}.webp`;
}

function wixBase(src) {
  const match = String(src).match(/(https?:\/\/static\.wixstatic\.com\/media\/[^/]+~mv2\.\w+)/i);
  return match ? match[1] : null;
}

function sourceKey(src) {
  return wixBase(src) || safeDecode(src);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getAttr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = tag.match(re);
  if (!match) return null;
  return match[2] ?? match[3] ?? "";
}

function setAttr(tag, name, value) {
  const safe = String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const re = new RegExp(`((?:^|\\s))${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`, "i");
  if (re.test(tag)) return tag.replace(re, `$1${name}="${safe}"`);
  return tag.replace(/\s*\/?>$/, (end) => ` ${name}="${safe}"${end}`);
}

function precedingText(html, index) {
  return html
    .slice(Math.max(0, index - 700), index)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function skipReason(img, preceding) {
  const src = img.src || "";
  const alt = img.alt || "";
  if (src.includes(DECORATIVE_WIX_ID)) {
    return "repeated decorative Wix image (image-prompt alt, outside figure)";
  }
  if (/^create a /i.test(alt.trim()) && alt.trim().length > 40) {
    return "decorative image (alt text is an image prompt)";
  }
  if (BOOK_WIX_IDS.some((id) => src.includes(id))) return "book-cover graphic";
  if (/touring\b/i.test(alt) && /by train/i.test(alt) && /amazon|available|guide|book/i.test(alt)) {
    return "book-cover graphic";
  }
  const file = safeDecode(src.split("?")[0].split("/").pop() || "");
  if (/\.png$/i.test(file) && /touring by train/i.test(preceding) && /guide/i.test(preceding)) {
    return "book-cover graphic (png next to the book-guide promo)";
  }
  return null;
}

function extractImages(html) {
  const images = [];
  const re = /<img\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[0];
    const src = getAttr(tag, "src");
    const alt = getAttr(tag, "alt");
    images.push({
      tag,
      index: match.index,
      src: src || "",
      alt: alt || "",
      loading: getAttr(tag, "loading"),
      decoding: getAttr(tag, "decoding"),
      pinMedia: getAttr(tag, "data-pin-media"),
      pinUrl: getAttr(tag, "data-pin-url"),
      className: getAttr(tag, "class"),
      skip: null,
    });
  }
  for (const img of images) {
    img.skip = skipReason(img, precedingText(html, img.index));
    img.key = sourceKey(img.src);
    img.wix = Boolean(wixBase(img.src));
    img.local = img.src.startsWith("/images/");
  }
  return images;
}

function rewriteBody(html, plansBySrc) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let next = tag;
    const src = getAttr(tag, "src");
    const plan = src ? plansBySrc.get(src) : null;
    if (plan) {
      next = setAttr(next, "src", plan.publicUrl);
      if (getAttr(next, "data-pin-media") != null) {
        next = setAttr(next, "data-pin-media", plan.publicUrl);
      }
    }
    if (getAttr(next, "loading") == null) {
      next = setAttr(next, "loading", "lazy");
      if (getAttr(next, "decoding") == null) {
        next = setAttr(next, "decoding", "async");
      }
    }
    return next;
  });
}

function stripImgTags(html) {
  return html.replace(/<img\b[^>]*>/gi, "");
}

function assertRewrite(before, after, plansBySrc) {
  if (stripImgTags(before) !== stripImgTags(after)) {
    throw new Error("Rewrite changed HTML outside <img> tags.");
  }
  const oldImgs = extractImages(before);
  const newImgs = extractImages(after);
  if (oldImgs.length !== newImgs.length) throw new Error("Rewrite changed the image count.");
  for (let i = 0; i < oldImgs.length; i++) {
    const prev = oldImgs[i];
    const next = newImgs[i];
    if (prev.alt !== next.alt) throw new Error("Rewrite changed alt text.");
    if (prev.pinUrl !== next.pinUrl) throw new Error("Rewrite changed data-pin-url.");
    if ((prev.className || "") !== (next.className || "")) throw new Error("Rewrite changed class.");
    const plan = plansBySrc.get(prev.src);
    if (plan) {
      if (next.src !== plan.publicUrl) throw new Error("Rewrite did not set the planned src.");
      if (prev.pinMedia != null && next.pinMedia !== plan.publicUrl) {
        throw new Error("Rewrite did not update data-pin-media.");
      }
    } else if (next.src !== prev.src) {
      throw new Error("Rewrite changed an image that was not processed.");
    }
    if (prev.loading == null) {
      if (next.loading !== "lazy" || next.decoding !== "async") {
        throw new Error("Rewrite did not add loading and decoding.");
      }
    } else if (next.loading !== prev.loading || next.decoding !== prev.decoding) {
      throw new Error("Rewrite changed loading or decoding that was already set.");
    }
  }
}

function selfCheck() {
  const html = [
    "<p>Keep this <a href=\"https://example.com/keep\">link</a>.</p>",
    "<figure data-hook=\"figure-IMAGE\"><img src=\"https://static.wixstatic.com/media/abc~mv2.jpg\" alt=\"Hello\" class=\"photo\" data-pin-url=\"https://www.realtravelguides.com/post/x\" data-pin-media=\"https://static.wixstatic.com/media/abc~mv2.jpg/v1/fill/w_10,h_10/abc~mv2.jpg\"><figcaption>Hello cap</figcaption></figure>",
    "<img src=\"/images/a.jpg\" alt=\"Local\" loading=\"lazy\" decoding=\"async\" />",
    "<img src=\"https://static.wixstatic.com/media/fef05b_5ae5d110be0842f4ba199067eec10538~mv2.jpg\" alt=\"Create a vibrant and retro-styled hero image for a website with bold, flat colors and strong type\">",
  ].join("");
  const decorative = extractImages(html).find((img) => img.src.includes(DECORATIVE_WIX_ID));
  if (!decorative?.skip) throw new Error("Self-check: decorative image was not skipped.");
  const bookHtml =
    "<p>Our best-selling Touring by Train guides make it easy.</p><figure><img src=\"https://static.wixstatic.com/media/book~mv2.png\" alt=\"\"></figure>";
  const book = extractImages(bookHtml)[0];
  if (!book.skip || !book.skip.startsWith("book-cover")) {
    throw new Error("Self-check: book graphic was not skipped.");
  }
  const amazonHtml =
    "<figure><img src=\"https://static.wixstatic.com/media/x~mv2.png\" alt=\"Touring France by Train Guide Now Available on Amazon\"></figure>";
  if (!extractImages(amazonHtml)[0].skip) throw new Error("Self-check: Amazon book alt was not skipped.");
  const emptyBook =
    "<img src=\"https://static.wixstatic.com/media/5f33fc_414c70517ef6455f82db193fc8513a1e~mv2.png\" alt=\"\">";
  if (!extractImages(emptyBook)[0].skip) throw new Error("Self-check: empty-alt book file was not skipped.");
  const photoHtml = "<figure><img src=\"/images/blog/town.jpg\" alt=\"The shore of Lake Constance\"></figure>";
  if (extractImages(photoHtml)[0].skip) throw new Error("Self-check: a photograph was skipped.");

  const planned = "https://example.supabase.co/storage/v1/object/public/post-images/content/slug/hello-deadbeef.webp";
  const plans = new Map([
    ["https://static.wixstatic.com/media/abc~mv2.jpg", { publicUrl: planned }],
  ]);
  const out = rewriteBody(html, plans);
  assertRewrite(html, out, plans);
  if (!out.includes("<figcaption>Hello cap</figcaption>")) throw new Error("Self-check: figcaption changed.");
  if (!out.includes("https://example.com/keep")) throw new Error("Self-check: link changed.");
  if ((out.match(/loading="lazy"/g) || []).length !== 3) throw new Error("Self-check: loading count.");
}

function localFilePath(src) {
  const rel = safeDecode(src).replace(/^\/+/, "");
  if (!rel.startsWith("images/")) return null;
  return path.join(projectRoot, "public", ...rel.split("/"));
}

const DOWNLOAD_ATTEMPTS = 5;
const DOWNLOAD_TIMEOUT_MS = 60_000;

function downloadRetryDelayMs(failedAttempt) {
  // 2s, 4s, 8s, 16s before attempts 2–5. No delay before the first attempt.
  return 2000 * 2 ** (failedAttempt - 1);
}

async function downloadUrl(url) {
  let lastError;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "RealTravelGuides-image-migration/1.0" },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error("empty response");
      return buffer;
    } catch (error) {
      lastError = error;
      const code = error.cause?.code || error.cause?.message || error.name || "";
      console.warn(
        `  download attempt ${attempt}/${DOWNLOAD_ATTEMPTS} failed: ${error.message}${code ? ` (${code})` : ""}`
      );
      if (attempt < DOWNLOAD_ATTEMPTS) {
        const delayMs = downloadRetryDelayMs(attempt);
        console.warn(`  waiting ${delayMs}ms before the next attempt`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  const code = lastError?.cause?.code || lastError?.cause?.message || lastError?.name || "";
  const wrapped = new Error(
    `download failed after ${DOWNLOAD_ATTEMPTS} attempts: ${lastError?.message || lastError}${code ? ` (${code})` : ""}`
  );
  wrapped.cause = lastError;
  throw wrapped;
}

async function readSource(img) {
  if (img.local) {
    const filePath = localFilePath(img.src);
    if (!filePath) throw new Error("not a public/images path");
    return readFile(filePath);
  }
  if (img.wix) return downloadUrl(img.src);
  throw new Error("not a Wix or local /images source");
}

async function encodeWebp(original) {
  const encoded = async (quality) => {
    const { data, info } = await sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, info, quality };
  };

  const input = await sharp(original, { failOn: "none" }).metadata();
  let result = await encoded(QUALITY);
  if (result.buffer.length > TARGET_MAX_BYTES) result = await encoded(QUALITY_IF_LARGE);

  const orientedWidth =
    input.orientation >= 5 && input.orientation <= 8 ? input.height : input.width;
  if (result.info.width > MAX_WIDTH) {
    throw new Error(`encoded width ${result.info.width} exceeds ${MAX_WIDTH}`);
  }
  if (orientedWidth && result.info.width > orientedWidth) {
    throw new Error(`encoded width ${result.info.width} enlarged from ${orientedWidth}`);
  }
  return {
    buffer: result.buffer,
    bytes: result.buffer.length,
    quality: result.quality,
    width: result.info.width,
    height: result.info.height,
  };
}

function fmt(bytes) {
  return `${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`;
}

function reduction(original, optimised) {
  if (!original) return "n/a";
  return `${(((original - optimised) / original) * 100).toFixed(1)}%`;
}

function publicObjectUrl(supabaseUrl, storagePath) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function isDecorativeSkip(img) {
  return img.skip && (img.src.includes(DECORATIVE_WIX_ID) || img.skip.startsWith("decorative"));
}

function corpusEstimate(posts) {
  const wixAll = new Set();
  const decorative = new Map();
  const books = new Map();
  const photoUses = new Map();

  const note = (map, img) => {
    const rec = map.get(img.key) || { uses: 0, alts: new Set(), reasons: new Set(), wix: img.wix, src: img.src };
    rec.uses += 1;
    if (img.alt) rec.alts.add(img.alt.slice(0, 140));
    if (img.skip) rec.reasons.add(img.skip);
    map.set(img.key, rec);
  };

  for (const post of posts) {
    for (const img of extractImages(post.body || "")) {
      if (!img.src) continue;
      if (img.wix) wixAll.add(img.key);
      if (isDecorativeSkip(img)) {
        note(decorative, img);
        continue;
      }
      if (img.skip) {
        note(books, img);
        continue;
      }
      if (!img.wix && !img.local) continue;
      note(photoUses, img);
    }
  }

  // The same file can be a book graphic in one article and fail the alt check
  // in another. If any use is decorative or a book graphic, exclude the file.
  const mixed = [];
  for (const [key, rec] of photoUses) {
    if (decorative.has(key) || books.has(key)) mixed.push(key + (rec.alts.size ? ` (${[...rec.alts].join("; ")})` : ""));
  }
  if (mixed.length) {
    throw new Error(`A book or decorative file is still counted as a photograph: ${mixed.join(" | ")}`);
  }
  for (const key of decorative.keys()) photoUses.delete(key);
  for (const key of books.keys()) photoUses.delete(key);

  let uniqueWixPhotographs = 0;
  let uniqueLocalPhotographs = 0;
  let photographPlacements = 0;
  for (const rec of photoUses.values()) {
    photographPlacements += rec.uses;
    if (rec.wix) uniqueWixPhotographs += 1;
    else uniqueLocalPhotographs += 1;
  }

  return {
    uniqueWix: wixAll.size,
    decorative: decorative.size,
    bookGraphics: books.size,
    uniqueWixPhotographs,
    uniqueLocalPhotographs,
    uniquePhotographs: uniqueWixPhotographs + uniqueLocalPhotographs,
    photographPlacements,
    excluded: [...decorative.entries(), ...books.entries()].map(([key, rec]) => ({
      key,
      uses: rec.uses,
      reasons: [...rec.reasons],
      alts: [...rec.alts],
    })),
  };
}

async function writeBackup(slug, body, mode) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, `${slug}.json`);
  try {
    await access(filePath);
    console.log(`Backup already exists; leaving the pre-migration file untouched: ${filePath}`);
    return filePath;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const payload = {
    slug,
    column: "posts.body",
    savedAt: new Date().toISOString(),
    mode,
    readOnlyCopy: mode !== "apply",
    note:
      "Original posts.body. To roll back a future apply, write this body back to posts.body for this slug. Do not delete original Wix objects or public/images files; those URLs remain valid. Do not delete this file as part of the migration.",
    body,
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function refuseUpload() {
  throw new Error("Refusing to upload without --apply.");
}

function refuseWrite() {
  throw new Error("Refusing to update posts.body without --apply.");
}

async function main() {
  selfCheck();
  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply && !args.dryRun;

  if (!args.slugs.length) {
    throw new Error("Pass one or more --slug=<post-slug>. Refusing to download every article.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const readKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !readKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in .env.local.");
  }
  if (apply && !serviceKey) {
    throw new Error("Refusing to apply without SUPABASE_SERVICE_ROLE_KEY.");
  }

  console.log(apply ? "Mode: APPLY" : "Mode: DRY RUN (default). No upload and no database write.");
  console.log(`Slugs: ${args.slugs.join(", ")}`);
  console.log(`Backups: ${BACKUP_DIR}`);

  let uploadWebp = refuseUpload;
  let updateBody = refuseWrite;
  if (apply) {
    const writer = createClient(supabaseUrl, serviceKey);
    uploadWebp = async (storagePath, buffer) => {
      if (!apply) refuseUpload();
      const { error } = await writer.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) throw new Error(error.message);
    };
    updateBody = async (slug, body) => {
      if (!apply) refuseWrite();
      const payload = { body };
      if ("cover" in payload || "images" in payload) {
        throw new Error("Refusing to modify cover or images.");
      }
      const { error } = await writer.from("posts").update(payload).eq("slug", slug);
      if (error) throw new Error(error.message);
    };
  }

  const reader = createClient(supabaseUrl, readKey);
  const { data: posts, error } = await reader.from("posts").select("slug,body,cover").limit(1000);
  if (error) throw new Error(error.message);
  if (!posts?.length) throw new Error("No posts returned.");

  const estimate = corpusEstimate(posts);
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "rtg-body-webp-"));
  console.log(`Temp WebP directory (outside the repo): ${tmpRoot}`);

  const articleReports = [];
  let cleanup = false;

  try {
    for (const slug of args.slugs) {
      const post = bySlug.get(slug);
      console.log(`\n=== ${slug} ===`);
      if (!post) {
        console.log("FAILED: post not found. No upload and no body update.");
        articleReports.push({ slug, missing: true });
        continue;
      }

      const backupPath = await writeBackup(slug, post.body || "", apply ? "apply" : "dry-run");
      console.log(`Backup (original body, not a database write): ${backupPath}`);
      console.log("Cover column: left unchanged.");

      const images = extractImages(post.body || "");
      const plansBySrc = new Map();
      const processed = [];
      const skipped = [];
      const failed = [];
      const seen = new Set();

      for (const img of images) {
        if (!img.src) continue;
        if (img.skip) {
          skipped.push({ src: img.src, alt: img.alt, reason: img.skip });
          console.log(`SKIP ${img.skip}`);
          console.log(`  ${img.src}`);
          continue;
        }
        if (!img.wix && !img.local) {
          skipped.push({ src: img.src, alt: img.alt, reason: "not a Wix or local body photograph" });
          console.log(`SKIP not a Wix or local body photograph: ${img.src}`);
          continue;
        }
        if (seen.has(img.src)) continue;
        seen.add(img.src);

        const filename = outputFilename(img.alt, img.src);
        const storagePath = `content/${slug}/${filename}`;
        const plannedUrl = publicObjectUrl(supabaseUrl, storagePath);
        try {
          console.log(`Encoding ${filename}`);
          const original = await readSource(img);
          const webp = await encodeWebp(original);
          const outPath = path.join(tmpRoot, slug, filename);
          await mkdir(path.dirname(outPath), { recursive: true });
          await writeFile(outPath, webp.buffer);
          const written = await stat(outPath);
          const record = {
            filename,
            storagePath,
            publicUrl: plannedUrl,
            originalBytes: original.length,
            optimisedBytes: written.size,
            quality: webp.quality,
            width: webp.width,
            height: webp.height,
            pinMedia: img.pinMedia != null,
            overFlag: written.size > FLAG_BYTES,
            alt: img.alt,
          };
          processed.push(record);
          plansBySrc.set(img.src, { publicUrl: plannedUrl });
          const flag = record.overFlag ? " OVER 500KB" : "";
          console.log(
            `  ${record.originalBytes} -> ${record.optimisedBytes} bytes, q${record.quality}, ${record.width}x${record.height}${flag}`
          );
          console.log(`  ${storagePath}`);
        } catch (imageError) {
          failed.push({ src: img.src, filename, message: imageError.message });
          console.log(`FAILED ${filename}: ${imageError.message}`);
        }
      }

      const newBody = rewriteBody(post.body || "", plansBySrc);
      assertRewrite(post.body || "", newBody, plansBySrc);

      const originalBytes = processed.reduce((sum, item) => sum + item.originalBytes, 0);
      const optimisedBytes = processed.reduce((sum, item) => sum + item.optimisedBytes, 0);
      const wouldUpdate = failed.length === 0 && processed.length > 0;
      console.log(`Original total: ${fmt(originalBytes)}`);
      console.log(`Optimised total: ${fmt(optimisedBytes)}`);
      console.log(`Reduction: ${reduction(originalBytes, optimisedBytes)}`);
      const overs = processed.filter((item) => item.overFlag);
      if (overs.length) {
        for (const item of overs) console.log(`OVER 500KB: ${item.filename} ${item.optimisedBytes} bytes`);
      } else {
        console.log("Over 500KB: none");
      }
      let bodyWritten = false;
      if (!wouldUpdate) {
        console.log("Body update skipped: an image failed, or there was nothing to process.");
      } else if (!apply) {
        console.log(`Planned body update: NOT written. Would replace ${processed.length} src value(s).`);
      } else {
        try {
          for (const item of processed) {
            const webp = await readFile(path.join(tmpRoot, slug, item.filename));
            await uploadWebp(item.storagePath, webp);
          }
          await updateBody(slug, newBody);
          bodyWritten = true;
          console.log(`Applied body update for ${slug}.`);
        } catch (applyError) {
          console.log(`Apply failed for ${slug}: ${applyError.message}`);
          console.log("Body was not updated. Original Wix and /images URLs are unchanged.");
        }
      }

      articleReports.push({
        slug,
        cover: post.cover,
        backupPath,
        processed,
        skipped: skipped.map((item) => ({ reason: item.reason, src: item.src, alt: item.alt })),
        failed,
        originalBytes,
        optimisedBytes,
        reduction: reduction(originalBytes, optimisedBytes),
        wouldUpdateBody: wouldUpdate && !apply,
        bodyWritten,
      });
    }

    const pilotImages = articleReports.flatMap((article) => article.processed || []);
    const pilotOptimised = pilotImages.reduce((sum, item) => sum + item.optimisedBytes, 0);
    const average = pilotImages.length ? Math.round(pilotOptimised / pilotImages.length) : 0;
    const estimatedBytes = average * estimate.uniquePhotographs;
    const placementBytes = average * estimate.photographPlacements;

    console.log("\n=== Pilot average and full-migration estimate ===");
    console.log(`Pilot images optimised: ${pilotImages.length}`);
    console.log(`Pilot average optimised size: ${fmt(average)}`);
    console.log(`Unique Wix body images: ${estimate.uniqueWix}`);
    console.log(`Excluded decorative assets: ${estimate.decorative}`);
    console.log(`Excluded book graphics: ${estimate.bookGraphics}`);
    console.log(`Unique Wix photographs: ${estimate.uniqueWixPhotographs}`);
    console.log(`Unique local body photographs: ${estimate.uniqueLocalPhotographs}`);
    console.log(`Unique photograph count: ${estimate.uniquePhotographs}`);
    console.log(
      `ESTIMATE storage for unique photographs: ${fmt(estimatedBytes)} (${estimate.uniquePhotographs} x ${average} bytes). Wix originals outside this pilot were not downloaded.`
    );
    console.log(
      `Photograph placements (a shared photo counted once per article): ${estimate.photographPlacements}. Per-article copies would be about ${fmt(placementBytes)} because each article gets its own file.`
    );
    console.log(
      "Bandwidth: body images stay ordinary <img> tags pointing at the public WebP URL. The browser fetches that file directly. They are not added to next/image, so Vercel image optimisation is not used. The cover is unchanged and remains the next/image LCP."
    );
    console.log(
      `Rollback: restore posts.body from the JSON files in ${BACKUP_DIR}. Original Wix and /images URLs stay valid, so do not delete those originals.`
    );

    const report = {
      mode: apply ? "apply" : "dry-run",
      uploads: 0,
      databaseWrites: 0,
      backupDir: BACKUP_DIR,
      averageOptimisedBytes: average,
      estimate,
      estimatedUniqueStorageBytes: estimatedBytes,
      estimatedPerArticleCopyBytes: placementBytes,
      articles: articleReports.map((article) => ({
        ...article,
        body: undefined,
      })),
    };
    if (!apply) {
      report.uploads = 0;
      report.databaseWrites = 0;
    }
    const reportPath = path.join(BACKUP_DIR, "dry-run-report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport (no secrets, no HTML): ${reportPath}`);
    console.log(apply ? "Apply path finished." : "Confirmation: nothing was uploaded and no database row was written.");
    cleanup = true;
  } finally {
    if (cleanup) {
      await rm(tmpRoot, { recursive: true, force: true });
      console.log(`Deleted temp WebP files: ${tmpRoot}`);
    } else {
      console.log(`Temp WebP files kept because the run did not finish: ${tmpRoot}`);
    }
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message || error);
  process.exit(1);
});
