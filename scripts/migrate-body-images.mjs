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
 *   node --use-system-ca scripts/migrate-body-images.mjs --bulk
 *   node --use-system-ca scripts/migrate-body-images.mjs --bulk --apply
 *
 * `--bulk` walks published articles in slug order. Without `--apply` it only
 * writes a plan outside the repo. With `--apply` it migrates remaining body
 * photographs in batches, continues after one article fails, and stops on a
 * widespread storage, database, or connection failure. Progress is recorded in
 * the backup directory so a later run can resume.
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
import { access, appendFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
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
const DEFAULT_BATCH_SIZE = 22;
const PILOT_SLUG_LIST = [
  "naples-in-spring-a-foodie-weekend-by-train",
  "a-summer-weekend-in-paris-by-train-how-to-experience-the-city-like-a-local",
  "london-to-zurich-by-train-via-strasbourg-and-lake-constance",
];
const PILOT_SLUGS = new Set(PILOT_SLUG_LIST);
const PROGRESS_FILE = path.join(BACKUP_DIR, "bulk-progress.json");
const UPLOAD_LOG = path.join(BACKUP_DIR, "bulk-uploads.jsonl");
const COVER_SNAPSHOT = path.join(BACKUP_DIR, "bulk-covers-images-before.json");
const PRESERVATION_SNAPSHOT = path.join(BACKUP_DIR, "bulk-preservation-before.json");
const PLAN_FILE = path.join(BACKUP_DIR, "bulk-plan.json");
const FINAL_SUMMARY = path.join(BACKUP_DIR, "bulk-final-summary.json");
const PIPELINE_ERROR_CLASSES = new Set(["connection", "storage", "database", "backup"]);

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
  const args = { slugs: [], apply: false, dryRun: false, bulk: false, batchSize: DEFAULT_BATCH_SIZE };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--bulk") args.bulk = true;
    else if (arg.startsWith("--slug=")) args.slugs.push(arg.slice("--slug=".length));
    else if (arg.startsWith("--batch-size=")) args.batchSize = Number(arg.slice("--batch-size=".length));
    else throw new Error(`Unknown argument: ${arg}`);
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
  const already = extractImages(
    '<img src="https://example.supabase.co/storage/v1/object/public/post-images/content/x/a.webp" alt="Hi">'
  )[0];
  if (already.skip || already.wix || already.local) {
    throw new Error("Self-check: an existing storage URL looked migratable.");
  }
}

function localFilePath(src) {
  const rel = safeDecode(src).replace(/^\/+/, "");
  if (!rel.startsWith("images/") || rel.includes("..")) return null;
  const filePath = path.join(projectRoot, "public", ...rel.split("/"));
  const publicRoot = path.join(projectRoot, "public");
  const relToPublic = path.relative(publicRoot, filePath);
  if (relToPublic.startsWith("..") || path.isAbsolute(relToPublic)) return null;
  return filePath;
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
  const encoded = storagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${encoded}`;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mediaType(header) {
  return String(header || "").split(";")[0].trim().toLowerCase();
}

function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
}

class FatalStop extends Error {
  constructor(message, resumeFromSlug) {
    super(message);
    this.name = "FatalStop";
    this.resumeFromSlug = resumeFromSlug || null;
  }
}

function calendarDay(now) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function publishedState(value, now) {
  if (value == null) return "missing";
  if (typeof value !== "string") return "unparseable";
  const raw = value.trim();
  if (!raw) return "missing";
  const day = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day <= calendarDay(now) ? "published" : "future";
  const time = new Date(raw).getTime();
  if (Number.isNaN(time)) return "unparseable";
  return time <= now.getTime() ? "published" : "future";
}

function storageFolder(slug) {
  // Supabase rejects object keys that contain non-ASCII characters, so a slug
  // such as "córdoba-..." cannot be used as a folder name. ASCII slugs stay
  // unchanged. Other slugs use the same transliteration as image filenames,
  // plus a short hash of the original slug so two articles cannot share a folder.
  if (/^[\x20-\x7e]+$/.test(slug)) return slug;
  return `${slugify(slug)}-${shortHash(slug)}`;
}

function assertPlainSlug(slug) {
  const unsafe = typeof slug !== "string" || slug.length < 1 || slug.length > 180
    || slug === "." || slug === ".." || slug.includes("..") || slug.includes("/") || slug.includes("\\")
    || /[<>:"|?*\u0000-\u001f]/.test(slug);
  if (unsafe) {
    const error = new Error(`Refusing slug that is not a plain filename: ${slug}`);
    error.code = "other";
    throw error;
  }
}

function backupPathFor(slug) {
  assertPlainSlug(slug);
  const filePath = path.resolve(BACKUP_DIR, `${slug}.json`);
  const rel = path.relative(path.resolve(BACKUP_DIR), filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    const error = new Error(`Backup path escaped the backup directory for ${slug}.`);
    error.code = "backup";
    throw error;
  }
  return filePath;
}

function migratablePhotographs(html) {
  const found = [];
  const seen = new Set();
  for (const img of extractImages(html || "")) {
    if (!img.src || img.skip || seen.has(img.src)) continue;
    if (!img.wix && !img.local) continue;
    seen.add(img.src);
    found.push(img);
  }
  return found;
}

function wixPhotoPlacements(html) {
  return extractImages(html || "").filter((img) => img.src && img.wix && !img.skip);
}

function localPhotoPlacements(html) {
  return extractImages(html || "").filter((img) => img.src && img.local && !img.skip);
}

function bodyLooksPreMigration(html) {
  return migratablePhotographs(html).length > 0;
}

function countedSrcs(posts, kind) {
  const counts = new Map();
  for (const post of posts) {
    for (const img of extractImages(post.body || "")) {
      if (!img.src) continue;
      const decorative = img.src.includes(DECORATIVE_WIX_ID) || (img.skip && String(img.skip).startsWith("decorative"));
      const book = Boolean(img.skip && String(img.skip).startsWith("book-cover"));
      const match = kind === "decorative" ? decorative : book;
      if (!match) continue;
      counts.set(img.src, (counts.get(img.src) || 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function classifyError(error) {
  const coded = error?.code;
  if (coded === "auth" || coded === "backup" || coded === "download" || coded === "encode" || PIPELINE_ERROR_CLASSES.has(coded)) {
    return coded;
  }
  const msg = String(error?.message || error);
  if (/^download failed/i.test(msg) || msg.includes("download failed after")) {
    if (/HTTP 429|HTTP 5\d\d|fetch failed|timeout|ECONN|ENOTFOUND|EAI_AGAIN|aborted|network/i.test(msg)) return "connection";
    return "download";
  }
  if (/unauthorized|invalid api key|jwt|permission denied|row-level security|not authorized/i.test(msg)) return "auth";
  if (/429|too many requests|rate limit/i.test(msg)) return "connection";
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket|aborted|timeout|ECONNREFUSED|UND_ERR/i.test(msg)) {
    return "connection";
  }
  if (/HTTP 5\d\d/.test(msg)) return "connection";
  if (/sharp|encoded width|Input buffer|unsupported image/i.test(msg)) return "encode";
  if (/ENOENT|no such file/i.test(msg)) return "download";
  if (/backup/i.test(msg)) return "backup";
  if (/database update|matched no row|PGRST/i.test(msg)) return "database";
  if (/storage|upload|overwrite|HEAD /i.test(msg)) return "storage";
  return "other";
}

function assertBodyOnly(payload) {
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== "body") {
    throw new Error("Refusing to write columns other than posts.body.");
  }
}

function resolveBatchSize(value) {
  if (!Number.isInteger(value) || value < 20 || value > 25) {
    throw new Error("Batch size must be an integer from 20 to 25.");
  }
  return value;
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const json = JSON.stringify(value, null, 2);
  const tmp = `${filePath}.${process.pid}.tmp`;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await writeFile(tmp, json);
      await rm(filePath, { force: true });
      await rename(tmp, filePath);
      return;
    } catch (error) {
      lastError = error;
      await sleep(400 * attempt);
    }
  }
  await writeFile(filePath, json);
  await rm(tmp, { force: true }).catch(() => {});
  if (lastError) console.warn(`Atomic replace fell back to a direct write: ${lastError.message}`);
}

async function ensureSnapshot(filePath, value) {
  try {
    await access(filePath);
    console.log(`Keeping existing snapshot: ${filePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await atomicWriteJson(filePath, value);
    console.log(`Wrote snapshot: ${filePath}`);
  }
}

function emptyProgress() {
  return {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "running",
    stopReason: null,
    resumeFromSlug: null,
    pilots: PILOT_SLUG_LIST,
    articles: {},
    batches: [],
    totals: {
      articlesMigrated: 0,
      photographsMigrated: 0,
      bytesUploaded: 0,
      nothingToDo: 0,
      failed: 0,
    },
    filesOver500KB: [],
    runs: [],
    unpublished: { missing: 0, unparseable: 0, future: [] },
  };
}

async function loadProgress() {
  try {
    const parsed = JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object" || !parsed.articles || typeof parsed.articles !== "object") {
      throw new FatalStop("Progress log is missing article records. Stopping so resume is not guessed.", null);
    }
    if (!Array.isArray(parsed.batches)) parsed.batches = [];
    if (!Array.isArray(parsed.runs)) parsed.runs = [];
    if (!parsed.totals || typeof parsed.totals !== "object") parsed.totals = {};
    return parsed;
  } catch (error) {
    if (error instanceof FatalStop) throw error;
    if (error?.code === "ENOENT") return emptyProgress();
    throw new FatalStop(`Progress log is unreadable (${error.message}). Stopping so resume is not guessed.`, null);
  }
}

async function sumUploads() {
  let raw = "";
  try {
    raw = await readFile(UPLOAD_LOG, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { bytes: 0, files: [] };
    throw error;
  }
  const seen = new Map();
  for (const line of raw.split(/\n+/)) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    const key = `${item.slug}/${item.filename}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  let bytes = 0;
  const files = [];
  for (const item of seen.values()) {
    bytes += Number(item.bytes) || 0;
    files.push(item);
  }
  return { bytes, files };
}

function recomputeCounts(progress) {
  let articlesMigrated = 0;
  let photographsMigrated = 0;
  let nothingToDo = 0;
  let failed = 0;
  const over = [];
  for (const article of Object.values(progress.articles)) {
    if (article.status === "migrated") {
      articlesMigrated += 1;
      photographsMigrated += article.photographCount || 0;
    } else if (article.status === "nothing-to-do") nothingToDo += 1;
    else if (article.status === "failed") failed += 1;
    for (const file of article.filesOver500KB || []) {
      over.push({ slug: article.slug, filename: file.filename, bytes: file.bytes, status: article.status });
    }
  }
  progress.totals.articlesMigrated = articlesMigrated;
  progress.totals.photographsMigrated = photographsMigrated;
  progress.totals.nothingToDo = nothingToDo;
  progress.totals.failed = failed;
  progress.filesOver500KB = over;
}

async function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  recomputeCounts(progress);
  progress.totals.bytesUploaded = (await sumUploads()).bytes;
  await atomicWriteJson(PROGRESS_FILE, progress);
}

async function rememberUpload(slug, filename, bytes) {
  const line = JSON.stringify({ slug, filename, bytes, at: new Date().toISOString() });
  await mkdir(BACKUP_DIR, { recursive: true });
  await appendFile(UPLOAD_LOG, `${line}\n`, "utf8");
}

function bytesForSlug(files, slug) {
  return files.filter((item) => item.slug === slug).reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
}

async function headWebp(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "RealTravelGuides-image-migration/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      const contentType = mediaType(response.headers.get("content-type"));
      return {
        status: response.status,
        contentType,
        ok: response.status === 200 && contentType === "image/webp",
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  const wrapped = new Error(`HEAD failed after 3 attempts: ${lastError?.message || lastError}`);
  wrapped.code = "connection";
  throw wrapped;
}

async function fetchAllPosts(reader) {
  const pageSize = 100;
  const posts = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await reader
      .from("posts")
      .select("slug,body,published_at,cover,images")
      .order("slug", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      const wrapped = new Error(error.message);
      if (/jwt|api key|unauthorized|permission|row-level security/i.test(error.message)) wrapped.code = "auth";
      else wrapped.code = "database";
      throw wrapped;
    }
    if (!data?.length) break;
    posts.push(...data);
    if (data.length < pageSize) break;
  }
  const seen = new Set();
  const unique = [];
  for (const post of posts.sort((a, b) => String(a.slug).localeCompare(String(b.slug)))) {
    if (!post?.slug || seen.has(post.slug)) continue;
    seen.add(post.slug);
    unique.push(post);
  }
  return unique;
}

async function ensureOriginalBackup(slug, body) {
  if (typeof body !== "string" || body.length === 0) {
    const error = new Error(`Refusing to back up an empty body for ${slug}.`);
    error.code = "backup";
    throw error;
  }
  if (!bodyLooksPreMigration(body)) {
    const error = new Error(`Refusing to back up ${slug}: the current body has no migratable photographs.`);
    error.code = "backup";
    throw error;
  }
  await mkdir(BACKUP_DIR, { recursive: true });
  const filePath = backupPathFor(slug);
  let existing = null;
  try {
    existing = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      const aside = `${filePath}.unreadable-${Date.now()}`;
      await rename(filePath, aside);
      console.log(`Moved an unreadable backup aside: ${aside}`);
    }
  }
  if (existing && typeof existing.body === "string") {
    const backupIsOriginal = bodyLooksPreMigration(existing.body) || existing.body === body;
    if (backupIsOriginal || !bodyLooksPreMigration(body)) {
      console.log(`Backup already exists; leaving the pre-migration file untouched: ${filePath}`);
      return filePath;
    }
    const aside = `${filePath}.not-original-${Date.now()}`;
    await rename(filePath, aside);
    console.log(`Existing backup was not a pre-migration body. Moved it aside: ${aside}`);
  }
  const payload = {
    slug,
    column: "posts.body",
    savedAt: new Date().toISOString(),
    mode: "apply",
    preMigration: true,
    note:
      "Original posts.body before bulk image migration. To roll back, write this body back to posts.body for this slug. Do not delete original Wix objects or files in public/images.",
    body,
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2));
  console.log(`Wrote pre-migration backup: ${filePath}`);
  return filePath;
}

async function updateBodyOnly(writer, slug, body) {
  const payload = { body };
  assertBodyOnly(payload);
  const { data, error } = await writer.from("posts").update(payload).eq("slug", slug).select("slug");
  if (error) {
    const wrapped = new Error(error.message);
    if (/jwt|api key|unauthorized|permission|row-level security|not authorized/i.test(error.message)) wrapped.code = "auth";
    else wrapped.code = "database";
    throw wrapped;
  }
  if (!data || data.length !== 1 || data[0]?.slug !== slug) {
    const wrapped = new Error("database update matched no row");
    wrapped.code = "database";
    throw wrapped;
  }
}

async function restoreBodyFromBackup(writer, reader, slug) {
  const parsed = JSON.parse(await readFile(backupPathFor(slug), "utf8"));
  if (typeof parsed.body !== "string" || parsed.body.length === 0) {
    const error = new Error(`Backup for ${slug} has no body to restore.`);
    error.code = "backup";
    throw error;
  }
  await updateBodyOnly(writer, slug, parsed.body);
  const { data, error } = await reader.from("posts").select("body").eq("slug", slug).maybeSingle();
  if (error || data?.body !== parsed.body) {
    const wrapped = new Error(error?.message || `Restore of ${slug} did not match the backup.`);
    wrapped.code = "database";
    throw wrapped;
  }
}

async function putWebp(writer, storagePath, publicUrl, buffer) {
  const before = await headWebp(publicUrl);
  if (before.ok) return { uploaded: false };
  if (before.status === 200 && String(before.contentType).startsWith("image/")) {
    const error = new Error(`Refusing to overwrite ${storagePath}: Content-Type is ${before.contentType || "missing"}`);
    error.code = "storage";
    throw error;
  }
  const { error } = await writer.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (!error) return { uploaded: true };
  const msg = error.message || String(error);
  if (/already exists|duplicate|resource exists/i.test(msg)) {
    const again = await headWebp(publicUrl);
    if (again.ok) return { uploaded: false };
    const wrapped = new Error(`Object exists but HEAD is HTTP ${again.status} ${again.contentType || "missing"}`);
    wrapped.code = "storage";
    throw wrapped;
  }
  const wrapped = new Error(msg);
  const status = Number(error.statusCode || error.status || 0);
  if (status === 401 || status === 403 || /unauthorized|jwt|invalid api key|permission|row-level security/i.test(msg)) {
    wrapped.code = "auth";
  } else if (status === 429 || status >= 500 || /fetch failed|network|timeout/i.test(msg)) {
    wrapped.code = "connection";
  } else {
    wrapped.code = "storage";
  }
  throw wrapped;
}

function articleFailure(slug, error, extras = {}) {
  const errorClass = extras.errorClass || classifyError(error);
  const fatal = errorClass === "auth" || extras.fatal === true;
  return {
    slug,
    status: "failed",
    photographCount: extras.photographCount || 0,
    bytesUploaded: 0,
    filesOver500KB: extras.filesOver500KB || [],
    error: extras.error || error?.message || String(error),
    imageErrors: extras.imageErrors || [],
    errorClass,
    fatal,
    fatalMessage: fatal ? extras.fatalMessage || error?.message || String(error) : null,
  };
}

async function migrateArticle(reader, writer, supabaseUrl, slug, tmpRoot) {
  const articleTmp = path.join(tmpRoot, slug);
  try {
    const { data: post, error } = await reader
      .from("posts")
      .select("slug,body,published_at,cover,images")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return articleFailure(slug, error);
    if (!post) return articleFailure(slug, new Error("post not found"));
    if (publishedState(post.published_at, new Date()) !== "published") {
      return articleFailure(slug, new Error(`published_at is not currently published (${post.published_at})`));
    }

    const photos = migratablePhotographs(post.body || "");
    if (!photos.length) {
      return {
        slug,
        status: "nothing-to-do",
        photographCount: 0,
        bytesUploaded: 0,
        filesOver500KB: [],
        error: null,
        imageErrors: [],
        errorClass: null,
        fatal: false,
      };
    }

    await ensureOriginalBackup(slug, post.body || "");
    await mkdir(articleTmp, { recursive: true });

    const plansBySrc = new Map();
    const processed = [];
    const imageErrors = [];
    for (const img of photos) {
      const filename = outputFilename(img.alt, img.src);
      const folder = storageFolder(slug);
      const storagePath = `content/${folder}/${filename}`;
      const publicUrl = publicObjectUrl(supabaseUrl, storagePath);
      try {
        if (!storagePath.startsWith(`content/${folder}/`) || !filename.endsWith(".webp") || !publicUrl.endsWith(".webp")) {
          throw new Error("Refusing a public URL that is not a direct WebP object URL.");
        }
        if (publicUrl.includes("/_next/image") || !publicUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) {
          throw new Error("Refusing to route a body image through next/image.");
        }
        console.log(`Encoding ${filename}`);
        const original = await readSource(img);
        const webp = await encodeWebp(original);
        const outPath = path.join(articleTmp, filename);
        await writeFile(outPath, webp.buffer);
        const written = await stat(outPath);
        processed.push({
          src: img.src,
          filename,
          storagePath,
          publicUrl,
          bytes: written.size,
          overFlag: written.size > FLAG_BYTES,
          alt: img.alt,
        });
        plansBySrc.set(img.src, { publicUrl });
        console.log(`  ${original.length} -> ${written.size} bytes, q${webp.quality}, ${webp.width}x${webp.height}`);
      } catch (imageError) {
        imageErrors.push({ src: img.src, message: imageError.message });
        console.log(`FAILED ${filename}: ${imageError.message}`);
        if (classifyError(imageError) === "connection") break;
      }
    }

    const filesOver500KB = processed.filter((item) => item.overFlag).map((item) => ({
      filename: item.filename,
      bytes: item.bytes,
    }));
    if (imageErrors.length || processed.length !== photos.length) {
      return articleFailure(slug, new Error(imageErrors.map((item) => `${item.src} — ${item.message}`).join(" | ")), {
        photographCount: 0,
        filesOver500KB,
        imageErrors,
        errorClass: classifyError({ message: imageErrors[0]?.message || "image failed" }),
      });
    }

    const paths = new Set();
    for (const item of processed) {
      if (paths.has(item.storagePath)) {
        return articleFailure(slug, new Error(`filename collision for ${item.storagePath}`), { filesOver500KB });
      }
      paths.add(item.storagePath);
    }

    const newBody = rewriteBody(post.body || "", plansBySrc);
    assertRewrite(post.body || "", newBody, plansBySrc);

    for (const item of processed) {
      const webp = await readFile(path.join(articleTmp, item.filename));
      const put = await putWebp(writer, item.storagePath, item.publicUrl, webp);
      if (put.uploaded) await rememberUpload(slug, item.filename, webp.length);
      else console.log(`Reusing existing object: ${item.storagePath}`);
    }

    for (const item of processed) {
      const head = await headWebp(item.publicUrl);
      if (!head.ok) {
        const message = `${item.src} -> ${item.publicUrl} — HEAD returned HTTP ${head.status} content-type ${head.contentType || "missing"}`;
        return articleFailure(slug, new Error(message), {
          filesOver500KB,
          imageErrors: [{ src: item.src, message }],
          errorClass: head.status >= 500 || head.status === 429 ? "connection" : "storage",
        });
      }
    }

    const beforeCover = post.cover ?? null;
    const beforeImages = post.images ?? null;
    await updateBodyOnly(writer, slug, newBody);

    try {
      for (const item of processed) {
        const head = await headWebp(item.publicUrl);
        if (!head.ok) {
          throw Object.assign(
            new Error(`${item.src} -> ${item.publicUrl} — HEAD returned HTTP ${head.status} content-type ${head.contentType || "missing"}`),
            { code: head.status >= 500 || head.status === 429 ? "connection" : "storage", src: item.src }
          );
        }
      }
      const { data: after, error: readError } = await reader
        .from("posts")
        .select("body,cover,images")
        .eq("slug", slug)
        .maybeSingle();
      if (readError) throw Object.assign(new Error(readError.message), { code: "database" });
      if (!sameJson(after?.cover ?? null, beforeCover) || !sameJson(after?.images ?? null, beforeImages)) {
        throw Object.assign(new Error("cover or images column changed during the body update"), { code: "database" });
      }
      if (migratablePhotographs(after?.body || "").length) {
        throw Object.assign(new Error("body still has migratable photographs after the update"), { code: "database" });
      }
      assertRewrite(post.body || "", after?.body || "", plansBySrc);
    } catch (verifyError) {
      try {
        await restoreBodyFromBackup(writer, reader, slug);
        console.log(`Restored original body for ${slug}.`);
        return articleFailure(slug, verifyError, {
          filesOver500KB,
          imageErrors: [{ src: verifyError.src || processed[0]?.src || "", message: verifyError.message }],
          error: `${verifyError.message}. Body restored from backup.`,
        });
      } catch (restoreError) {
        return articleFailure(slug, restoreError, {
          filesOver500KB,
          fatal: true,
          fatalMessage: `Restore failed for ${slug} after ${verifyError.message}: ${restoreError.message}`,
          error: `${verifyError.message}. RESTORE FAILED: ${restoreError.message}`,
          errorClass: "database",
        });
      }
    }

    return {
      slug,
      status: "migrated",
      photographCount: processed.length,
      bytesUploaded: 0,
      filesOver500KB,
      error: null,
      imageErrors: [],
      errorClass: null,
      fatal: false,
    };
  } catch (error) {
    if (error instanceof FatalStop) throw error;
    return articleFailure(slug, error);
  } finally {
    await rm(articleTmp, { recursive: true, force: true });
  }
}

function toRecord(result, bytesUploaded) {
  return {
    slug: result.slug,
    status: result.status,
    photographCount: result.photographCount || 0,
    bytesUploaded,
    filesOver500KB: result.filesOver500KB || [],
    error: result.error || null,
    imageErrors: result.imageErrors || [],
    errorClass: result.errorClass || null,
    updatedAt: new Date().toISOString(),
  };
}

function earliestRemaining(queue, progress) {
  for (const post of queue) {
    if (progress.articles[post.slug]?.status !== "migrated") return post.slug;
  }
  return null;
}

function contentWebpCount(slug, html) {
  const folder = storageFolder(slug);
  const encodedFolder = encodeURIComponent(folder);
  const seen = new Set();
  for (const img of extractImages(html || "")) {
    const src = img.src || "";
    const inFolder = src.includes(`/storage/v1/object/public/${BUCKET}/content/${folder}/`)
      || src.includes(`/storage/v1/object/public/${BUCKET}/content/${encodedFolder}/`);
    if (inFolder && /\.webp(?:$|\?)/i.test(src)) seen.add(src);
  }
  return seen.size;
}

async function recoverMigratedArticle(slug, body, uploadFiles) {
  if (migratablePhotographs(body).length) return null;
  const photographCount = contentWebpCount(slug, body);
  if (!photographCount) return null;
  try {
    const parsed = JSON.parse(await readFile(backupPathFor(slug), "utf8"));
    if (typeof parsed.body !== "string" || !bodyLooksPreMigration(parsed.body)) return null;
  } catch {
    return null;
  }
  return {
    slug,
    status: "migrated",
    photographCount,
    bytesUploaded: bytesForSlug(uploadFiles, slug),
    filesOver500KB: uploadFiles
      .filter((item) => item.slug === slug && item.bytes > FLAG_BYTES)
      .map((item) => ({ filename: item.filename, bytes: item.bytes })),
    error: null,
    imageErrors: [],
    recoveredFromBody: true,
    updatedAt: new Date().toISOString(),
  };
}

async function probeMissingObject(supabaseUrl) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/content/__migration-probe__/missing-${shortHash(String(Date.now()))}.webp`;
  try {
    const head = await headWebp(url);
    return { status: head.status, contentType: head.contentType, ok: head.ok };
  } catch (error) {
    return { status: 0, contentType: "", ok: false, error: error.message };
  }
}

async function probeExistingWebp(posts) {
  for (const slug of PILOT_SLUG_LIST) {
    const post = posts.find((item) => item.slug === slug);
    if (!post) continue;
    const img = extractImages(post.body || "").find((item) => item.src.includes("/storage/v1/object/public/post-images/"));
    if (!img) continue;
    try {
      const head = await headWebp(img.src);
      return { slug, status: head.status, contentType: head.contentType, ok: head.ok };
    } catch (error) {
      return { slug, status: 0, contentType: "", ok: false, error: error.message };
    }
  }
  return { slug: null, status: 0, contentType: "", ok: false, error: "no pilot storage URL found" };
}

async function writeFinalSummary(reader, progress) {
  const coverBefore = JSON.parse(await readFile(COVER_SNAPSHOT, "utf8"));
  const preservationBefore = JSON.parse(await readFile(PRESERVATION_SNAPSHOT, "utf8"));
  const posts = await fetchAllPosts(reader);
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const preservedPosts = (preservationBefore.slugs || []).map((slug) => bySlug.get(slug)).filter(Boolean);
  const decorativeAfter = countedSrcs(preservedPosts, "decorative");
  const booksAfter = countedSrcs(preservedPosts, "book");
  const published = posts.filter((post) => publishedState(post.published_at, new Date()) === "published");
  const remainingWix = [];
  const remainingLocal = [];
  for (const post of published) {
    if (PILOT_SLUGS.has(post.slug)) continue;
    const wix = wixPhotoPlacements(post.body || "").length;
    const local = localPhotoPlacements(post.body || "").length;
    if (wix) remainingWix.push({ slug: post.slug, wixPhotoUrls: wix });
    if (local) remainingLocal.push({ slug: post.slug, localPhotoUrls: local });
  }
  const mismatches = [];
  for (const before of coverBefore.rows || []) {
    const after = bySlug.get(before.slug);
    const coverSame = Boolean(after) && sameJson(after.cover ?? null, before.cover ?? null);
    const imagesSame = Boolean(after) && sameJson(after.images ?? null, before.images ?? null);
    if (!after || !coverSame || !imagesSame) {
      mismatches.push({ slug: before.slug, missing: !after, coverSame, imagesSame });
    }
  }
  const sample = [];
  for (const before of (coverBefore.rows || []).slice(0, 5)) {
    const after = bySlug.get(before.slug);
    sample.push({
      slug: before.slug,
      coverUnchanged: Boolean(after) && sameJson(after?.cover ?? null, before.cover ?? null),
      imagesUnchanged: Boolean(after) && sameJson(after?.images ?? null, before.images ?? null),
      coverHash: digest(before.cover ?? null),
      imagesHash: digest(before.images ?? null),
    });
  }
  const migrated = Object.values(progress.articles).find((article) => article.status === "migrated");
  if (migrated && !sample.some((item) => item.slug === migrated.slug)) {
    const before = (coverBefore.rows || []).find((row) => row.slug === migrated.slug);
    const after = bySlug.get(migrated.slug);
    if (before) {
      sample.push({
        slug: migrated.slug,
        coverUnchanged: Boolean(after) && sameJson(after?.cover ?? null, before.cover ?? null),
        imagesUnchanged: Boolean(after) && sameJson(after?.images ?? null, before.images ?? null),
        coverHash: digest(before.cover ?? null),
        imagesHash: digest(before.images ?? null),
      });
    }
  }
  const failed = Object.values(progress.articles)
    .filter((article) => article.status === "failed")
    .map((article) => ({
      slug: article.slug,
      error: article.error,
      imageErrors: article.imageErrors || [],
      errorClass: article.errorClass || null,
    }));
  const summary = {
    finished: progress.status === "finished",
    stopped: progress.status === "stopped",
    stopReason: progress.stopReason,
    resumeFromSlug: progress.resumeFromSlug,
    articlesMigrated: progress.totals.articlesMigrated,
    photographsMigrated: progress.totals.photographsMigrated,
    bytesUploaded: progress.totals.bytesUploaded,
    nothingToDo: progress.totals.nothingToDo,
    failed,
    filesOver500KB: progress.filesOver500KB || [],
    remainingWixPhotographs: remainingWix,
    remainingLocalPhotographs: remainingLocal,
    decorativeUnchanged: sameJson(preservationBefore.decorative, decorativeAfter),
    bookGraphicsUnchanged: sameJson(preservationBefore.books, booksAfter),
    coversAndImagesUnchanged: mismatches.length === 0,
    coverOrImagesMismatches: mismatches,
    sampleColumnCheck: sample,
    updatesOnlyPostsBody: true,
    pilotsSkipped: PILOT_SLUG_LIST,
    pilotWarnings: PILOT_SLUG_LIST.map((slug) => ({
      slug,
      remainingMigratable: progress.articles[slug]?.remainingMigratable ?? null,
    })),
    updatedAt: new Date().toISOString(),
  };
  await atomicWriteJson(FINAL_SUMMARY, summary);
  return summary;
}

async function runBulk(args) {
  const apply = args.apply && !args.dryRun;
  const batchSize = resolveBatchSize(args.batchSize);
  sharp.cache(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const readKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !readKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in .env.local.");
  if (apply && !serviceKey) throw new Error("Refusing to apply without SUPABASE_SERVICE_ROLE_KEY.");

  console.log(apply ? "Mode: BULK APPLY" : "Mode: BULK PLAN. No upload and no database write.");
  console.log(`Backups and progress: ${BACKUP_DIR}`);
  console.log("Database writes are limited to posts.body. Cover and images are never included in an update.");
  console.log(`Pilot slugs skipped: ${PILOT_SLUG_LIST.join(", ")}`);

  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const reader = createClient(supabaseUrl, readKey, clientOptions);
  const writer = apply ? createClient(supabaseUrl, serviceKey, clientOptions) : null;

  console.log("Reading posts...");
  const posts = await fetchAllPosts(reader);
  console.log(`Posts read: ${posts.length}`);
  const now = new Date();
  const published = [];
  const unpublished = { missing: 0, unparseable: 0, future: [] };
  for (const post of posts) {
    const state = publishedState(post.published_at, now);
    if (state === "published") published.push(post);
    else if (state === "future") unpublished.future.push(post.slug);
    else unpublished[state] += 1;
  }

  const coverSnapshot = {
    savedAt: new Date().toISOString(),
    note: "cover and images columns before bulk body migration. The migration must not change these.",
    rows: posts.map((post) => ({ slug: post.slug, cover: post.cover ?? null, images: post.images ?? null })),
  };
  const preservationSnapshot = {
    savedAt: new Date().toISOString(),
    slugs: published.map((post) => post.slug),
    decorative: countedSrcs(published, "decorative"),
    books: countedSrcs(published, "book"),
  };
  await ensureSnapshot(COVER_SNAPSHOT, coverSnapshot);
  await ensureSnapshot(PRESERVATION_SNAPSHOT, preservationSnapshot);

  const probe = await probeExistingWebp(posts);
  const missingProbe = await probeMissingObject(supabaseUrl);
  console.log(
    `HEAD probe: ${probe.ok ? "ok" : "FAILED"} status=${probe.status} content-type=${probe.contentType || probe.error || "missing"} slug=${probe.slug || "none"}`
  );
  console.log(
    `HEAD missing-object probe: status=${missingProbe.status} content-type=${missingProbe.contentType || missingProbe.error || "missing"} ok=${missingProbe.ok}`
  );

  if (!apply) {
    const queue = [];
    const nothingToDo = [];
    for (const post of published) {
      if (PILOT_SLUGS.has(post.slug)) continue;
      const photos = migratablePhotographs(post.body || "");
      if (!photos.length) nothingToDo.push(post.slug);
      else queue.push({ slug: post.slug, photographs: photos.length, local: photos.filter((img) => img.local).length, wix: photos.filter((img) => img.wix).length });
    }
    const plan = {
      published: published.length,
      unpublished,
      pilots: PILOT_SLUG_LIST,
      nothingToDo,
      queue,
      photographCount: queue.reduce((sum, item) => sum + item.photographs, 0),
      probe,
      missingProbe,
      portoSlug: "porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train-1",
      portoInQueue: queue.some((item) => item.slug === "porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train-1"),
      batchSize,
      uploads: 0,
      databaseWrites: 0,
    };
    await atomicWriteJson(PLAN_FILE, plan);
    console.log(`Plan: ${queue.length} articles, ${plan.photographCount} photographs, ${nothingToDo.length} nothing-to-do.`);
    console.log(`Porto Ercole duplicate in queue: ${plan.portoInQueue}`);
    console.log(`Plan file: ${PLAN_FILE}`);
    console.log("Confirmation: plan mode uploaded nothing and wrote no post row.");
    return;
  }

  if (!probe.ok) {
    throw new FatalStop(
      `HEAD probe of an existing pilot WebP failed (status ${probe.status}, content-type ${probe.contentType || probe.error || "missing"}). Stopping before any upload.`,
      null
    );
  }
  if (missingProbe.ok || (missingProbe.status === 200 && String(missingProbe.contentType).startsWith("image/"))) {
    throw new FatalStop(
      `HEAD of a missing object looked like a real image (status ${missingProbe.status}, content-type ${missingProbe.contentType || "missing"}). Stopping before any upload.`,
      null
    );
  }

  let progress = await loadProgress();
  progress.status = "running";
  progress.stopReason = null;
  progress.unpublished = unpublished;
  const run = { startedAt: new Date().toISOString(), mode: "apply" };
  progress.runs.push(run);

  for (const slug of PILOT_SLUG_LIST) {
    const post = posts.find((item) => item.slug === slug);
    const remaining = post ? migratablePhotographs(post.body || "").length : null;
    progress.articles[slug] = {
      slug,
      status: "skipped-pilot",
      photographCount: 0,
      bytesUploaded: progress.articles[slug]?.bytesUploaded || 0,
      filesOver500KB: [],
      error: null,
      imageErrors: [],
      remainingMigratable: remaining,
      updatedAt: new Date().toISOString(),
    };
    if (remaining) console.warn(`WARNING: pilot ${slug} still has ${remaining} migratable photograph(s). It will not be changed.`);
  }

  const queue = [];
  const knownUploads = await sumUploads();
  for (const post of published) {
    if (PILOT_SLUGS.has(post.slug)) continue;
    const record = progress.articles[post.slug];
    if (record?.status === "migrated" && migratablePhotographs(post.body || "").length === 0) continue;
    const photos = migratablePhotographs(post.body || "");
    if (!photos.length) {
      const recovered = await recoverMigratedArticle(post.slug, post.body || "", knownUploads.files);
      if (recovered) {
        progress.articles[post.slug] = recovered;
        console.log(`Recovered already-migrated article from its body and backup: ${post.slug}`);
        continue;
      }
      progress.articles[post.slug] = {
        slug: post.slug,
        status: "nothing-to-do",
        photographCount: 0,
        bytesUploaded: record?.bytesUploaded || 0,
        filesOver500KB: record?.filesOver500KB || [],
        error: null,
        imageErrors: [],
        updatedAt: new Date().toISOString(),
      };
      continue;
    }
    queue.push(post);
  }
  if (queue.some((post) => PILOT_SLUGS.has(post.slug))) {
    throw new FatalStop("A pilot slug entered the migration queue. Stopping.", queue[0]?.slug || null);
  }
  await saveProgress(progress);
  console.log(`Articles with photographs to migrate: ${queue.length}`);

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "rtg-body-webp-"));
  console.log(`Temp WebP directory (outside the repo): ${tmpRoot}`);
  let stop = null;
  let streak = { cls: null, count: 0 };
  let rateLimitHits = 0;

  try {
    let batchNumber = progress.batches.length;
    for (const batchPosts of chunk(queue, batchSize)) {
      batchNumber += 1;
      const batch = {
        index: batchNumber,
        slugs: batchPosts.map((post) => post.slug),
        articlesSucceeded: 0,
        photographsMigrated: 0,
        bytesAdded: 0,
        failures: [],
        filesOver500KB: [],
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      const bytesAtStart = (await sumUploads()).bytes;
      let pipelineFailures = 0;
      try {
        for (const post of batchPosts) {
          console.log(`\n=== [${queue.indexOf(post) + 1}/${queue.length}] ${post.slug} ===`);
          const result = await migrateArticle(reader, writer, supabaseUrl, post.slug, tmpRoot);
          const uploads = await sumUploads();
          result.bytesUploaded = bytesForSlug(uploads.files, result.slug);
          progress.articles[result.slug] = toRecord(result, result.bytesUploaded);
          await saveProgress(progress);
          console.log(
            `${result.status.toUpperCase()} ${result.slug} photographs=${result.photographCount} bytesUploaded=${result.bytesUploaded}`
          );
          if (result.error) console.log(`  error: ${result.error}`);

          if (result.status === "migrated") {
            batch.articlesSucceeded += 1;
            batch.photographsMigrated += result.photographCount;
            streak = { cls: null, count: 0 };
          } else if (result.status === "failed") {
            batch.failures.push({ slug: result.slug, error: result.error, errorClass: result.errorClass });
            if (PIPELINE_ERROR_CLASSES.has(result.errorClass)) {
              pipelineFailures += 1;
              if (streak.cls === result.errorClass) streak.count += 1;
              else streak = { cls: result.errorClass, count: 1 };
            } else {
              streak = { cls: null, count: 0 };
            }
            if (/429|too many requests|rate limit/i.test(result.error || "")) rateLimitHits += 1;
          } else {
            streak = { cls: null, count: 0 };
          }
          for (const file of result.filesOver500KB || []) {
            batch.filesOver500KB.push({ slug: result.slug, filename: file.filename, bytes: file.bytes });
          }

          if (result.fatal || result.errorClass === "auth") {
            stop = new FatalStop(result.fatalMessage || result.error || "Supabase auth failed.", earliestRemaining(queue, progress));
            break;
          }
          if (rateLimitHits >= 2) {
            stop = new FatalStop(`Stopped after repeated rate-limit responses. Last article: ${result.slug}`, earliestRemaining(queue, progress));
            break;
          }
          if (streak.count >= 5) {
            stop = new FatalStop(
              `Stopped after 5 consecutive ${streak.cls} failures. Last article: ${result.slug}`,
              earliestRemaining(queue, progress)
            );
            break;
          }
          if (pipelineFailures / batchPosts.length > 0.3) {
            stop = new FatalStop(
              `Stopped because ${pipelineFailures} of ${batchPosts.length} articles in batch ${batch.index} failed with connection, storage, or database errors.`,
              earliestRemaining(queue, progress)
            );
            break;
          }
        }
      } finally {
        batch.bytesAdded = (await sumUploads()).bytes - bytesAtStart;
        batch.finishedAt = new Date().toISOString();
        progress.batches.push(batch);
        await saveProgress(progress);
        console.log(
          `BATCH_SUMMARY index=${batch.index} succeeded=${batch.articlesSucceeded} photographs=${batch.photographsMigrated} bytesAdded=${batch.bytesAdded} failures=${batch.failures.length} over500=${batch.filesOver500KB.length}`
        );
      }
      if (stop) break;
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
    console.log(`Deleted temp WebP files: ${tmpRoot}`);
  }

  if (stop) {
    progress.status = "stopped";
    progress.stopReason = stop.message;
    progress.resumeFromSlug = stop.resumeFromSlug || earliestRemaining(queue, progress);
  } else {
    progress.status = "finished";
    progress.stopReason = null;
    progress.resumeFromSlug = earliestRemaining(queue, progress);
  }
  run.endedAt = new Date().toISOString();
  run.status = progress.status;
  await saveProgress(progress);

  let summary;
  try {
    summary = await writeFinalSummary(reader, progress);
  } catch (error) {
    summary = {
      finished: progress.status === "finished",
      stopped: progress.status === "stopped",
      stopReason: progress.stopReason,
      resumeFromSlug: progress.resumeFromSlug,
      articlesMigrated: progress.totals.articlesMigrated,
      photographsMigrated: progress.totals.photographsMigrated,
      bytesUploaded: progress.totals.bytesUploaded,
      auditError: error.message,
    };
    await atomicWriteJson(FINAL_SUMMARY, summary);
  }
  console.log(`\nFinal summary file: ${FINAL_SUMMARY}`);
  console.log(
    `articlesMigrated=${summary.articlesMigrated} photographs=${summary.photographsMigrated} bytesUploaded=${summary.bytesUploaded} status=${progress.status}`
  );
  if (progress.status === "stopped") {
    console.error(`STOPPED: ${progress.stopReason}`);
    console.error(`Resume from slug: ${progress.resumeFromSlug}`);
    process.exitCode = 2;
  } else if (progress.resumeFromSlug) {
    console.log(`Run finished. First article that still needs a retry: ${progress.resumeFromSlug}`);
  } else {
    console.log("Run finished. No remaining queued articles.");
  }
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
  if (args.bulk) {
    if (args.slugs.length) throw new Error("Pass either --bulk or --slug, not both.");
    await runBulk(args);
    return;
  }
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
