/**
 * Final migration of remaining Wix-hosted images (book covers, text graphics,
 * decorative assets) into the public Supabase bucket `post-images`.
 *
 * Article photographs were already moved. This script does not change titles,
 * categories, places, publication dates, or any text that only mentions Wix.
 *
 *   node --use-system-ca scripts/migrate-wix-graphics.mjs
 *   node --use-system-ca scripts/migrate-wix-graphics.mjs --apply
 *   node --use-system-ca scripts/migrate-wix-graphics.mjs --validate
 *
 * Default is an audit: read the database and the repo, download each unique
 * image so its pixel size can be recorded, and write an inventory outside the
 * repo. It does not upload and does not write the database.
 *
 * `--apply` uploads each unique image once under post-images/graphics/ and,
 * only after a public HEAD returns HTTP 200 with an image content-type,
 * replaces that exact Wix URL. An existing object is reused and never
 * overwritten. A download that fails five times is left unchanged.
 *
 * Backups and the progress log:
 *   C:\Users\carol\OneDrive\Documents\rtg-image-migration-backup\wix-final\
 */

import { createHash } from "node:crypto";
import { access, appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(projectRoot, ".env.local") });

const BUCKET = "post-images";
const BACKUP_DIR = "C:\\Users\\carol\\OneDrive\\Documents\\rtg-image-migration-backup\\wix-final";
const DOWNLOAD_ATTEMPTS = 5;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_WIDTH = 1600;
const LOSSLESS_BYTE_CAP = 2_000_000;

const BOOK_IDS = [
  "5f33fc_414c70517ef6455f82db193fc8513a1e",
  "5f33fc_d5782bc2f91a4c889bc28da5eb8a8917",
  "5f33fc_db6f5f5f1e2c43f3b9d2c7894f45926e",
  "5f33fc_df33390de29a4579bb2d8b5f4fd3c3ed",
  "5f33fc_abac134a58794f2bae46463fff3768fe",
  "5f33fc_8ad6563fe1fd4ea2b8d15bf5761b6cbb",
  "5f33fc_9b7bed425f034ef58f277d23c0792e2c",
  "5f33fc_5e9bab111d1240de837af0adb60fe99b",
];
const DECORATIVE_ID = "fef05b_5ae5d110be0842f4ba199067eec10538";

const POST_WRITABLE = ["body", "cover", "images", "excerpt", "video_url"];
const POST_FROZEN = ["title", "categories", "places", "published_at", "read_minutes", "slug"];
const AUTHOR_WRITABLE = ["photo", "short_bio", "full_bio"];
const BOOK_WRITABLE = ["cover", "tagline", "description", "highlights"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "dist", "coverage"]);
const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".md",
  ".json",
  ".svg",
  ".sql",
  ".txt",
  ".xml",
  ".yml",
  ".yaml",
]);

const WIX_URL_RE =
  /(?:https?:)?\/\/[^\s"'<>)\\]*?(?:wixstatic\.com|wixmp\.com|wixsite\.com|parastorage\.com)[^\s"'<>)\\]*/gi;

function parseArgs(argv) {
  const args = { apply: false, validate: false };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--validate") args.validate = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.apply && args.validate) throw new Error("Pass either --apply or --validate.");
  return args;
}

function redact(value) {
  return String(value ?? "")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted-key]");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function shortHash(value) {
  return sha256(value).slice(0, 8);
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

function cleanTrailing(url) {
  return url.replace(/[.,;:]+$/g, "");
}

function decodeHtmlUrl(url) {
  return url
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"');
}

function normaliseFoundUrl(raw) {
  let url = cleanTrailing(raw);
  if (url.startsWith("//")) url = `https:${url}`;
  return url;
}

function isWixHostedImage(url) {
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|m3u8|mp3|mov|m4v)(\?|$)/i.test(lower)) return false;
  if (lower.includes("wixstatic.com")) return true;
  const imageExt = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?|$|\/)/i.test(lower);
  if (lower.includes("wixmp.com")) return imageExt || /\/images?\//i.test(lower);
  if (lower.includes("wixsite.com") || lower.includes("parastorage.com")) return imageExt;
  return false;
}

function canonicalMediaUrl(url) {
  const decoded = decodeHtmlUrl(url);
  try {
    const parsed = new URL(decoded);
    if (/(^|\.)wixstatic\.com$/i.test(parsed.hostname)) {
      const match = parsed.pathname.match(/^\/media\/([^/]+)/i);
      if (match) return `${parsed.protocol}//${parsed.host}/media/${decodeURIComponent(match[1])}`;
    }
  } catch {
    /* keep the decoded string */
  }
  return decoded.split("?")[0];
}

function groupKey(url) {
  const canonical = canonicalMediaUrl(url);
  const crop = decodeHtmlUrl(url).match(/\/v1\/crop\/([^/]+)/i);
  if (crop) return `${canonical}::crop::${crop[1]}`;
  return canonical;
}

function getAttr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = tag.match(re);
  if (!match) return null;
  return match[2] ?? match[3] ?? "";
}

function extractWixUrls(text) {
  if (typeof text !== "string" || !text) return [];
  const found = [];
  const re = new RegExp(WIX_URL_RE.source, "gi");
  let match;
  while ((match = re.exec(text))) {
    const url = normaliseFoundUrl(match[0]);
    if (!isWixHostedImage(url)) continue;
    found.push({ url, index: match.index });
  }
  return found;
}

function locateAttribute(text, index, url) {
  const before = text.slice(Math.max(0, index - 160), index);
  const attr = before.match(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"[^"]*|'[^']*)$/);
  if (attr) return attr[1].toLowerCase();
  if (/url\(\s*['"]?$/i.test(before)) return "css-url";
  const imgStart = text.lastIndexOf("<img", index);
  const imgEnd = text.indexOf(">", index);
  if (imgStart >= 0 && imgEnd > index && imgEnd - imgStart < 4000) {
    const tag = text.slice(imgStart, imgEnd + 1);
    if (tag.includes(url)) return "img";
  }
  return "text";
}

function altForOccurrence(text, index, url) {
  const imgStart = text.lastIndexOf("<img", index);
  if (imgStart < 0) return "";
  const imgEnd = text.indexOf(">", index);
  if (imgEnd < 0 || imgEnd - imgStart > 4000) return "";
  const tag = text.slice(imgStart, imgEnd + 1);
  if (!tag.includes(url)) return "";
  return getAttr(tag, "alt") ?? "";
}

function replaceExactUrls(text, urlMap) {
  if (typeof text !== "string" || text.length === 0 || urlMap.size === 0) return text;
  const urls = [...urlMap.keys()].sort((a, b) => b.length - a.length);
  let out = text;
  for (const url of urls) {
    if (!out.includes(url)) continue;
    out = out.split(url).join(urlMap.get(url));
  }
  return out;
}

function mapStrings(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = mapStrings(item, fn);
    return out;
  }
  return value;
}

function stripUrls(value, urls) {
  const sorted = [...urls].sort((a, b) => b.length - a.length);
  return mapStrings(value, (text) => {
    let out = text;
    for (const url of sorted) out = out.split(url).join("");
    return out;
  });
}

function assertOnlyUrlsChanged(before, after, oldUrls, newUrls) {
  const urls = [...oldUrls, ...newUrls];
  const left = JSON.stringify(stripUrls(before, urls));
  const right = JSON.stringify(stripUrls(after, urls));
  if (left !== right) {
    throw new Error("Replacement changed more than the image URL.");
  }
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fileStem(kind, alt, key) {
  if (kind === "decorative") return "decorative-retro-hero";
  if (String(key || "").includes("5f33fc_5e9bab111d1240de837af0adb60fe99b")) return "europe-by-train-made-easy";
  const slug = slugify(alt);
  const country = slug.match(/touring-(france|spain|switzerland|italy|portugal|austria|germany|england)/);
  if (country) return `touring-${country[1]}-by-train`;
  if (slug.length >= 8) return slug.slice(0, 48).replace(/-+$/g, "");
  if (kind === "book-graphic") return "book-cover";
  return "graphic";
}

function classify(canonical, alts) {
  const haystack = `${canonical}\n${alts.join("\n")}`;
  if (haystack.includes(DECORATIVE_ID)) return "decorative";
  if (BOOK_IDS.some((id) => haystack.includes(id))) return "book-graphic";
  const alt = alts.map((item) => item.trim()).find(Boolean) || "";
  if (/^create a /i.test(alt) && alt.length > 40) return "decorative";
  if (/touring\b/i.test(alt) && /by train/i.test(alt)) return "book-graphic";
  if (/amazon/i.test(alt) && /guide|book|touring/i.test(alt)) return "book-graphic";
  return "graphic";
}

function bestAlt(alts) {
  return [...alts].map((item) => String(item || "").trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] || "";
}

function downloadCandidates(exactUrls) {
  const decoded = [...new Set(exactUrls.map((url) => decodeHtmlUrl(url)))];
  const crops = decoded.filter((url) => /\/v1\/crop\//i.test(url));
  if (crops.length) return crops;
  const list = [];
  const original = decoded.find((url) => !/\/v1\//i.test(url));
  if (original) list.push(original);
  const canonical = canonicalMediaUrl(decoded[0]);
  if (!list.includes(canonical)) list.push(canonical);
  const fills = decoded
    .filter((url) => /\/v1\/fill\//i.test(url))
    .sort((a, b) => fillWidth(b) - fillWidth(a));
  for (const fill of fills) {
    if (!list.includes(fill)) list.push(fill);
  }
  for (const url of decoded) {
    if (!list.includes(url)) list.push(url);
  }
  return list;
}

function fillWidth(url) {
  const match = url.match(/(?:^|[,/])w_(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function orientedSize(meta) {
  let width = meta.width || 0;
  let height = meta.height || 0;
  if (meta.orientation >= 5 && meta.orientation <= 8) {
    const swap = width;
    width = height;
    height = swap;
  }
  return { width, height, format: meta.format || "" };
}

function selfCheck() {
  const long = "https://static.wixstatic.com/media/abc~mv2.jpg/v1/fill/w_10,h_10/abc~mv2.jpg";
  const short = "https://static.wixstatic.com/media/abc~mv2.jpg";
  const html = `<img src="${long}" alt="Touring France by Train Guide Now Available on Amazon" data-pin-media="${short}">`;
  const supa = "https://example.supabase.co/storage/v1/object/public/post-images/graphics/touring-france-by-train-deadbeef.webp";
  const map = new Map([
    [long, supa],
    [short, supa],
  ]);
  const out = replaceExactUrls(html, map);
  if (out !== `<img src="${supa}" alt="Touring France by Train Guide Now Available on Amazon" data-pin-media="${supa}">`) {
    throw new Error("Self-check: URL replacement changed surrounding HTML.");
  }
  if (out.includes("/v1/fill") || out.includes("wixstatic")) {
    throw new Error("Self-check: a Wix URL survived replacement.");
  }
  const excerpt = "We left Wix in January 2, 2024. The guide is still in print.";
  if (replaceExactUrls(excerpt, map) !== excerpt) {
    throw new Error("Self-check: excerpt text was rewritten.");
  }
  assertOnlyUrlsChanged(html, out, [long, short], [supa]);
  const found = extractWixUrls(html);
  if (found.length !== 2) throw new Error("Self-check: expected two Wix URLs.");
  if (groupKey(long) !== groupKey(short)) throw new Error("Self-check: fill URL did not group with its original.");
  const cropped = `${short}/v1/crop/x_1,y_2,w_3,h_4/fill/w_8,h_9/file.jpg`;
  if (groupKey(cropped) === groupKey(short)) throw new Error("Self-check: a crop grouped with the full image.");
  if (classify(short, ["Create a vibrant and retro-styled hero image for a website with bold type"]) !== "decorative") {
    throw new Error("Self-check: decorative alt was not classified.");
  }
  if (classify(`https://static.wixstatic.com/media/${BOOK_IDS[0]}~mv2.png`, [""]) !== "book-graphic") {
    throw new Error("Self-check: book id was not classified.");
  }
  if (isWixHostedImage("https://video.wixstatic.com/video/clip.mp4")) {
    throw new Error("Self-check: a video was treated as an image.");
  }
}

function contentMediaType(header) {
  return String(header || "").split(";")[0].trim().toLowerCase();
}

async function downloadOnce(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = contentMediaType(response.headers.get("content-type"));
  if (
    contentType &&
    !contentType.startsWith("image/") &&
    contentType !== "application/octet-stream" &&
    contentType !== "binary/octet-stream"
  ) {
    throw new Error(`content-type ${contentType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("empty response");
  if (buffer.length > 40 * 1024 * 1024) throw new Error("image larger than 40MB");
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height) throw new Error("downloaded file is not a readable image");
  return buffer;
}

function retryDelayMs(failedAttempt) {
  return 2000 * 2 ** (failedAttempt - 1);
}

async function downloadWithRetries(url) {
  let lastError;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      return await downloadOnce(url);
    } catch (error) {
      lastError = error;
      console.warn(`  download attempt ${attempt}/${DOWNLOAD_ATTEMPTS} failed: ${redact(error.message)}`);
      if (attempt < DOWNLOAD_ATTEMPTS) {
        const delay = retryDelayMs(attempt);
        console.warn(`  waiting ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw new Error(`download failed after ${DOWNLOAD_ATTEMPTS} attempts: ${redact(lastError?.message || lastError)}`);
}

async function downloadFirstAvailable(candidates) {
  const errors = [];
  for (const url of candidates) {
    try {
      const buffer = await downloadWithRetries(url);
      return { buffer, downloadedFrom: url };
    } catch (error) {
      errors.push(`${url} -> ${redact(error.message)}`);
      console.warn(`  giving up on this source URL and trying the next candidate, if any`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function headImage(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "RealTravelGuides-image-migration/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      const contentType = contentMediaType(response.headers.get("content-type"));
      return {
        status: response.status,
        contentType,
        ok: response.status === 200 && contentType.startsWith("image/"),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  return { status: 0, contentType: "", ok: false, error: redact(lastError?.message || lastError) };
}

async function encodeGraphic(original) {
  const inputMeta = await sharp(original, { failOn: "none" }).metadata();
  const source = orientedSize(inputMeta);
  const rotated = sharp(original, { failOn: "none" }).rotate();
  let pipeline = rotated;
  if (source.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, height: undefined, fit: "inside", withoutEnlargement: true });
  }

  async function render(format) {
    const branch = pipeline.clone();
    if (format === "lossless") {
      return branch.webp({ lossless: true, effort: 6, smartSubsample: false }).toBuffer({ resolveWithObject: true });
    }
    if (format === "near-lossless") {
      return branch
        .webp({ nearLossless: true, quality: 90, effort: 6, smartSubsample: false, alphaQuality: 100 })
        .toBuffer({ resolveWithObject: true });
    }
    if (format === "q90") {
      return branch
        .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: false })
        .toBuffer({ resolveWithObject: true });
    }
    return branch.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  }

  const q90 = await render("q90");
  let lossless = null;
  let near = null;
  let png = null;
  try {
    lossless = await render("lossless");
  } catch (error) {
    console.warn(`  lossless WebP encode failed: ${redact(error.message)}`);
  }
  try {
    near = await render("near-lossless");
  } catch (error) {
    console.warn(`  near-lossless WebP encode failed: ${redact(error.message)}`);
  }
  try {
    png = await render("png");
  } catch (error) {
    console.warn(`  PNG encode failed: ${redact(error.message)}`);
  }

  const candidates = [];
  if (lossless) candidates.push({ label: "lossless", ext: "webp", contentType: "image/webp", result: lossless });
  if (near) candidates.push({ label: "near-lossless", ext: "webp", contentType: "image/webp", result: near });
  candidates.push({ label: "q90", ext: "webp", contentType: "image/webp", result: q90 });
  if (png) candidates.push({ label: "png", ext: "png", contentType: "image/png", result: png });

  function acceptable(item) {
    const bytes = item.result.data.length;
    if (item.label === "q90") return true;
    if (item.label === "png") return bytes <= LOSSLESS_BYTE_CAP && bytes + 20_000 < q90.data.length;
    if (item.label === "lossless") return bytes <= LOSSLESS_BYTE_CAP && bytes <= q90.data.length * 3;
    if (item.label === "near-lossless") return bytes <= LOSSLESS_BYTE_CAP && bytes <= q90.data.length * 2;
    return false;
  }

  const order = ["lossless", "near-lossless", "q90", "png"];
  let chosen = candidates.find((item) => item.label === "q90");
  for (const label of order) {
    const item = candidates.find((candidate) => candidate.label === label);
    if (item && acceptable(item)) {
      chosen = item;
      break;
    }
  }
  if (png && png.data.length + 20_000 < chosen.result.data.length && png.data.length <= LOSSLESS_BYTE_CAP) {
    chosen = candidates.find((item) => item.label === "png");
  }

  const info = chosen.result.info;
  if (info.width > source.width || info.height > source.height) {
    throw new Error(`encoded image enlarged from ${source.width}x${source.height} to ${info.width}x${info.height}`);
  }
  if (info.width > MAX_WIDTH) {
    throw new Error(`encoded width ${info.width} exceeds ${MAX_WIDTH}`);
  }
  return {
    buffer: chosen.result.data,
    bytes: chosen.result.data.length,
    width: info.width,
    height: info.height,
    ext: chosen.ext,
    contentType: chosen.contentType,
    encode: chosen.label,
    sourceWidth: source.width,
    sourceHeight: source.height,
    sourceFormat: source.format,
    candidateBytes: Object.fromEntries(candidates.map((item) => [item.label, item.result.data.length])),
  };
}

function originalFilePath(key) {
  return path.join(BACKUP_DIR, "originals", `${sha256(key).slice(0, 16)}.img`);
}

async function readSavedOriginal(key) {
  const filePath = originalFilePath(key);
  try {
    const buffer = await readFile(filePath);
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return null;
    return buffer;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    console.warn(`  saved original is unreadable and was left in place: ${redact(error.message)}`);
    return null;
  }
}

async function saveOriginal(key, buffer) {
  const filePath = originalFilePath(key);
  try {
    await access(filePath);
    return filePath;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, filePath);
  return filePath;
}

async function loadProgress() {
  const filePath = path.join(BACKUP_DIR, "progress.json");
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    parsed.images ||= {};
    parsed.rows ||= {};
    parsed.files ||= {};
    return parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`Progress file could not be read and will not be overwritten blindly: ${redact(error.message)}`);
    }
    return { images: {}, rows: {}, files: {}, createdAt: new Date().toISOString() };
  }
}

async function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  await mkdir(BACKUP_DIR, { recursive: true });
  const filePath = path.join(BACKUP_DIR, "progress.json");
  const tmp = `${filePath}.${process.pid}.tmp`;
  const body = JSON.stringify(progress, null, 2);
  await writeFile(tmp, body);
  try {
    await rename(tmp, filePath);
  } catch {
    await writeFile(filePath, body);
    await rm(tmp, { force: true });
  }
}

async function logProgress(event) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  await appendFile(path.join(BACKUP_DIR, "progress.jsonl"), `${line}\n`, "utf8");
}

async function writeJsonNew(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await access(filePath);
    return false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(filePath, JSON.stringify(value, null, 2), { flag: "wx" });
  return true;
}

function supabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
  return { supabaseUrl, supabase: createClient(supabaseUrl, serviceKey) };
}

async function fetchAll(supabase, table) {
  const pageSize = 20;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (table === "posts" || table === "authors" || table === "books" || table === "categories") {
      query = supabase.from(table).select("*").order("slug", { ascending: true }).range(from, from + pageSize - 1);
    }
    const { data, error } = await query;
    if (error) throw new Error(`${table} read failed: ${redact(error.message)}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function walkStrings(value, fieldPath, visitor) {
  if (typeof value === "string") visitor(fieldPath, value);
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, `${fieldPath}[${index}]`, visitor));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (fieldPath === "" && key === "slug") continue;
      walkStrings(item, fieldPath ? `${fieldPath}.${key}` : key, visitor);
    }
  }
}

function snippet(text, index) {
  return text.slice(Math.max(0, index - 50), Math.min(text.length, index + 90)).replace(/\s+/g, " ");
}

function collectRowHits(table, row) {
  const hits = [];
  const mentions = [];
  const slug = row.slug || row.id || "";
  walkStrings(row, "", (field, text) => {
    if (field === "slug") return;
    for (const found of extractWixUrls(text)) {
      hits.push({
        table,
        slug,
        field: field.split(".")[0].replace(/\[\d+\]$/, "") || field,
        fieldPath: field,
        attribute: locateAttribute(text, found.index, found.url),
        alt: altForOccurrence(text, found.index, found.url),
        url: found.url,
        published_at: row.published_at || null,
      });
    }
    if (/\bwix\b/i.test(text)) {
      const re = /\bwix\b/gi;
      let match;
      while ((match = re.exec(text))) {
        const around = text.slice(Math.max(0, match.index - 24), match.index + 8);
        if (/wixstatic|wixmp|wixsite|https?:/i.test(around)) continue;
        mentions.push({
          table,
          slug,
          field: field.split(".")[0],
          snippet: snippet(text, match.index),
        });
      }
    }
    if (/wixstatic|wixmp|wixsite/i.test(text) && extractWixUrls(text).length === 0) {
      const index = text.search(/wixstatic|wixmp|wixsite/i);
      mentions.push({
        table,
        slug,
        field: field.split(".")[0],
        snippet: snippet(text, index),
        unparsed: true,
      });
    }
  });
  return { hits, mentions };
}

async function walkRepoFiles() {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  await walk(projectRoot);
  return files;
}

function isRuntimeFile(relativePath) {
  const normalised = relativePath.replaceAll("\\", "/");
  if (normalised === "lib/related-posts.ts") return false;
  if (normalised.startsWith("scripts/")) return false;
  if (normalised === "package-lock.json" || normalised === "package.json") return false;
  return /^(app|components|lib|public|supabase)\//.test(normalised);
}

async function scanRepo() {
  const hits = [];
  const mentions = [];
  const files = await walkRepoFiles();
  for (const filePath of files) {
    const relativePath = path.relative(projectRoot, filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    if (relativePath.replaceAll("\\", "/") === "package-lock.json") continue;
    let text;
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      continue;
    }
    if (!/wix/i.test(text)) continue;
    for (const found of extractWixUrls(text)) {
      hits.push({
        file: relativePath.replaceAll("\\", "/"),
        runtime: isRuntimeFile(relativePath),
        attribute: locateAttribute(text, found.index, found.url),
        alt: altForOccurrence(text, found.index, found.url),
        url: found.url,
      });
    }
    if (/\bwix\b/i.test(text)) {
      const re = /\bwix\b/gi;
      let match;
      let count = 0;
      while ((match = re.exec(text))) {
        const around = text.slice(Math.max(0, match.index - 24), match.index + 8);
        if (/wixstatic|wixmp|wixsite|https?:/i.test(around)) continue;
        if (count < 3) {
          mentions.push({
            file: relativePath.replaceAll("\\", "/"),
            runtime: isRuntimeFile(relativePath),
            snippet: snippet(text, match.index),
          });
        }
        count += 1;
      }
    }
  }
  return { hits, mentions };
}

function buildGroups(dbHits, repoHits) {
  const groups = new Map();
  function add(url, usage) {
    const key = groupKey(url);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        canonical: canonicalMediaUrl(url),
        exactUrls: new Set(),
        alts: new Set(),
        usages: [],
      };
      groups.set(key, group);
    }
    group.exactUrls.add(url);
    if (usage.alt) group.alts.add(usage.alt);
    group.usages.push({ ...usage, url });
  }
  for (const hit of dbHits) add(hit.url, hit);
  for (const hit of repoHits.filter((item) => item.runtime)) add(hit.url, hit);
  const list = [];
  for (const group of groups.values()) {
    const alts = [...group.alts];
    const kind = classify(group.canonical, alts);
    list.push({
      key: group.key,
      canonical: group.canonical,
      kind,
      alt: bestAlt(alts),
      exactUrls: [...group.exactUrls],
      usages: group.usages,
    });
  }
  list.sort((a, b) => a.canonical.localeCompare(b.canonical));
  return list;
}

function publicUrlFor(supabaseUrl, storagePath) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function backupRow(table, slug, fields) {
  const filePath = path.join(BACKUP_DIR, "rows", `${table}__${slug}.json`);
  const created = await writeJsonNew(filePath, {
    table,
    slug,
    savedAt: new Date().toISOString(),
    note: "Original values of the fields that contained Wix image URLs, saved before the first write. Do not overwrite.",
    fields,
  });
  if (!created) console.log(`Backup already exists; left untouched: ${filePath}`);
  else console.log(`Wrote backup: ${filePath}`);
  return filePath;
}

async function backupFile(relativePath, contents) {
  const safe = relativePath.replaceAll(/[^A-Za-z0-9._-]+/g, "__");
  const filePath = path.join(BACKUP_DIR, "files", `${safe}.json`);
  const created = await writeJsonNew(filePath, {
    file: relativePath,
    savedAt: new Date().toISOString(),
    original: contents,
  });
  if (!created) console.log(`File backup already exists; left untouched: ${filePath}`);
  return filePath;
}

function writableFields(table) {
  if (table === "posts") return POST_WRITABLE;
  if (table === "authors") return AUTHOR_WRITABLE;
  if (table === "books") return BOOK_WRITABLE;
  return [];
}

function frozenFields(table) {
  if (table === "posts") return POST_FROZEN;
  if (table === "authors") return ["slug", "name", "contact_email"];
  if (table === "books") return ["slug", "title", "author_slug", "amazon_url"];
  return ["slug"];
}

function replacementPayload(row, table, urlMap) {
  const payload = {};
  for (const field of writableFields(table)) {
    if (!(field in row)) continue;
    const next = mapStrings(row[field], (text) => replaceExactUrls(text, urlMap));
    if (!jsonEqual(next, row[field])) {
      assertOnlyUrlsChanged(row[field], next, [...urlMap.keys()], [...new Set(urlMap.values())]);
      payload[field] = next;
    }
  }
  for (const field of frozenFields(table)) {
    if (field in payload) throw new Error(`Refusing to change ${table}.${field}`);
  }
  if (typeof payload.body === "string" && typeof row.body === "string" && payload.body.length < row.body.length * 0.5) {
    throw new Error(`Refusing to write ${row.slug}: body shrank by more than half.`);
  }
  return payload;
}

async function updateOneRow(supabase, table, row, urlMap) {
  const slug = row.slug;
  const payload = replacementPayload(row, table, urlMap);
  const fields = Object.keys(payload);
  if (!fields.length) return { slug, updated: false, fields: [] };
  await backupRow(
    table,
    slug,
    Object.fromEntries(fields.map((field) => [field, row[field]]))
  );
  const { data, error } = await supabase.from(table).update(payload).eq("slug", slug).select("slug");
  if (error) throw new Error(`${table} ${slug} update failed: ${redact(error.message)}`);
  if (!data || data.length !== 1 || data[0]?.slug !== slug) {
    throw new Error(`${table} ${slug} update did not match exactly one row.`);
  }
  const verifyFields = [...new Set([...frozenFields(table), ...fields])];
  const { data: fresh, error: readError } = await supabase
    .from(table)
    .select(verifyFields.join(","))
    .eq("slug", slug)
    .maybeSingle();
  if (readError || !fresh) throw new Error(`${table} ${slug} could not be re-read after update.`);
  for (const field of frozenFields(table)) {
    if (field in row && !jsonEqual(fresh[field], row[field])) {
      await supabase.from(table).update(Object.fromEntries(fields.map((key) => [key, row[key]]))).eq("slug", slug);
      throw new Error(`${table} ${slug} changed frozen field ${field}; the write was reversed.`);
    }
  }
  for (const field of fields) {
    if (!jsonEqual(fresh[field], payload[field])) {
      throw new Error(`${table} ${slug} field ${field} did not match the replacement after update.`);
    }
  }
  return { slug, updated: true, fields };
}

async function optimiseAndStore(supabase, supabaseUrl, group, progress) {
  const existing = progress.images[group.key];
  if (existing?.status === "verified" && existing.publicUrl) {
    const head = await headImage(existing.publicUrl);
    if (head.ok) {
      console.log(`  already verified, reusing ${existing.publicUrl}`);
      await logProgress({ event: "skip-upload", key: group.key, publicUrl: existing.publicUrl, status: head.status });
      return {
        ok: true,
        uploaded: false,
        bytes: 0,
        publicUrl: existing.publicUrl,
        storagePath: existing.storagePath,
        httpStatus: head.status,
        contentType: head.contentType,
        width: existing.width || null,
        height: existing.height || null,
        sourceWidth: existing.sourceWidth || null,
        sourceHeight: existing.sourceHeight || null,
        encode: existing.encode || "reused",
        filename: existing.filename,
      };
    }
    existing.status = "head-failed";
    existing.headError = head.error || `HTTP ${head.status} ${head.contentType || ""}`.trim();
    await saveProgress(progress);
    await logProgress({ event: "head-failed", key: group.key, publicUrl: existing.publicUrl, error: existing.headError });
    return { ok: false, error: `Previous object failed HEAD (${existing.headError}). References were not changed.` };
  }

  let buffer = await readSavedOriginal(group.key);
  let downloadedFrom = buffer ? "saved-original" : "";
  if (!buffer) {
    const downloaded = await downloadFirstAvailable(downloadCandidates(group.exactUrls));
    buffer = downloaded.buffer;
    downloadedFrom = downloaded.downloadedFrom;
    await saveOriginal(group.key, buffer);
  } else {
    console.log("  using the original already saved in the backup folder");
  }

  const encoded = await encodeGraphic(buffer);
  const stem = fileStem(group.kind, group.alt, group.key);
  const filename = `${stem}-${shortHash(group.key)}.${encoded.ext}`;
  const storagePath = `graphics/${filename}`;
  for (const [otherKey, image] of Object.entries(progress.images)) {
    if (otherKey !== group.key && image.storagePath === storagePath) {
      return { ok: false, error: `Filename collision on ${storagePath}. Nothing was uploaded.` };
    }
  }
  const publicUrl = publicUrlFor(supabaseUrl, storagePath);
  let head = await headImage(publicUrl);
  let uploaded = false;
  if (head.ok) {
    console.log(`  object already exists; reusing ${publicUrl}`);
  } else if (head.status === 200 && !head.ok) {
    return {
      ok: false,
      error: `Refusing to overwrite ${storagePath}: HEAD HTTP 200 content-type ${head.contentType || "missing"}.`,
    };
  } else if (head.status !== 0 && head.status !== 400 && head.status !== 404) {
    return { ok: false, error: `HEAD before upload returned HTTP ${head.status} for ${publicUrl}. Nothing was written.` };
  } else {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, encoded.buffer, {
      contentType: encoded.contentType,
      upsert: false,
    });
    if (error) {
      const message = redact(error.message || error);
      if (!/already exists|duplicate|resource exists/i.test(message)) {
        return { ok: false, error: `Upload failed: ${message}` };
      }
      console.log("  upload reported the object already exists; checking it");
    } else {
      uploaded = true;
    }
    head = await headImage(publicUrl);
    if (!head.ok) {
      return {
        ok: false,
        error: `Uploaded object failed verification: HTTP ${head.status} content-type ${head.contentType || "missing"}. References were not changed.`,
      };
    }
  }

  const record = {
    status: "verified",
    key: group.key,
    canonical: group.canonical,
    kind: group.kind,
    filename,
    storagePath,
    publicUrl,
    httpStatus: head.status,
    contentType: head.contentType,
    bytes: uploaded ? encoded.bytes : 0,
    storedBytes: encoded.bytes,
    uploaded,
    width: encoded.width,
    height: encoded.height,
    sourceWidth: encoded.sourceWidth,
    sourceHeight: encoded.sourceHeight,
    sourceFormat: encoded.sourceFormat,
    encode: encoded.encode,
    candidateBytes: encoded.candidateBytes,
    downloadedFrom,
    verifiedAt: new Date().toISOString(),
  };
  progress.images[group.key] = record;
  await saveProgress(progress);
  await logProgress({
    event: uploaded ? "uploaded" : "reused",
    key: group.key,
    publicUrl,
    bytes: record.bytes,
    httpStatus: head.status,
    contentType: head.contentType,
  });
  return { ok: true, uploaded, bytes: uploaded ? encoded.bytes : 0, ...record };
}

async function scanLive(supabase) {
  const posts = await fetchAll(supabase, "posts");
  const authors = await fetchAll(supabase, "authors");
  const books = await fetchAll(supabase, "books");
  let categories = [];
  try {
    categories = await fetchAll(supabase, "categories");
  } catch (error) {
    console.warn(`Category scan skipped: ${redact(error.message)}`);
  }
  const dbHits = [];
  const mentions = [];
  const rowsByKey = new Map();
  for (const [table, rows] of [
    ["posts", posts],
    ["authors", authors],
    ["books", books],
    ["categories", categories],
  ]) {
    for (const row of rows) {
      const key = `${table}:${row.slug || row.id}`;
      rowsByKey.set(key, { table, row });
      const collected = collectRowHits(table, row);
      dbHits.push(...collected.hits);
      mentions.push(...collected.mentions);
    }
  }
  const repo = await scanRepo();
  const groups = buildGroups(dbHits, repo.hits);
  return { posts, authors, books, categories, dbHits, mentions, repo, groups, rowsByKey };
}

function summariseGroup(group, extra = {}) {
  const slugs = [...new Set(group.usages.filter((usage) => usage.slug).map((usage) => `${usage.table}:${usage.slug}`))];
  const files = [...new Set(group.usages.filter((usage) => usage.file).map((usage) => usage.file))];
  const attributes = [...new Set(group.usages.map((usage) => usage.attribute))];
  return {
    canonical: group.canonical,
    kind: group.kind,
    alt: group.alt,
    exactUrls: group.exactUrls,
    attributes,
    slugs,
    files,
    usageCount: group.usages.length,
    ...extra,
  };
}

async function measureGroup(group) {
  try {
    let buffer = await readSavedOriginal(group.key);
    let downloadedFrom = buffer ? "saved-original" : "";
    if (!buffer) {
      const downloaded = await downloadFirstAvailable(downloadCandidates(group.exactUrls));
      buffer = downloaded.buffer;
      downloadedFrom = downloaded.downloadedFrom;
      await saveOriginal(group.key, buffer);
    }
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    const size = orientedSize(meta);
    return {
      sourceWidth: size.width,
      sourceHeight: size.height,
      sourceFormat: size.format,
      sourceBytes: buffer.length,
      downloadedFrom,
      downloadError: null,
    };
  } catch (error) {
    return {
      sourceWidth: null,
      sourceHeight: null,
      sourceFormat: null,
      sourceBytes: null,
      downloadedFrom: null,
      downloadError: redact(error.message),
    };
  }
}

async function validate(supabase, supabaseUrl, progress) {
  const live = await scanLive(supabase);
  const remainingImages = live.groups.map((group) => summariseGroup(group));
  const scriptOnly = live.repo.hits.filter((hit) => !hit.runtime);
  const heads = [];
  for (const image of Object.values(progress?.images || {})) {
    if (!image.publicUrl || image.status !== "verified") continue;
    const head = await headImage(image.publicUrl);
    heads.push({
      publicUrl: image.publicUrl,
      status: head.status,
      contentType: head.contentType,
      ok: head.ok,
      error: head.error || null,
    });
  }
  return {
    postsScanned: live.posts.length,
    remainingImageGroups: remainingImages,
    remainingImageOccurrences: live.dbHits.length + live.repo.hits.filter((hit) => hit.runtime).length,
    scriptOnlyUrlFiles: [...new Set(scriptOnly.map((hit) => hit.file))],
    nonImageMentions: {
      database: live.mentions.length,
      repo: live.repo.mentions.length,
    },
    heads,
    live,
  };
}

async function main() {
  selfCheck();
  const args = parseArgs(process.argv.slice(2));
  const { supabaseUrl, supabase } = supabaseConfig();
  console.log(`Supabase host: ${new URL(supabaseUrl).host}`);
  console.log(args.apply ? "Mode: APPLY" : args.validate ? "Mode: VALIDATE" : "Mode: AUDIT (no upload, no database write)");
  await mkdir(BACKUP_DIR, { recursive: true });

  const progress = await loadProgress();
  if (args.validate) {
    const result = await validate(supabase, supabaseUrl, progress);
    const report = {
      validatedAt: new Date().toISOString(),
      postsScanned: result.postsScanned,
      remainingImageGroups: result.remainingImageGroups,
      remainingImageOccurrences: result.remainingImageOccurrences,
      scriptOnlyUrlFiles: result.scriptOnlyUrlFiles,
      nonImageMentions: result.nonImageMentions,
      heads: result.heads,
    };
    await writeFile(path.join(BACKUP_DIR, "validation.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Scanning posts, authors, books, categories, and the repo...");
  const live = await scanLive(supabase);
  console.log(
    `Scanned ${live.posts.length} posts, ${live.authors.length} authors, ${live.books.length} books, ${live.categories.length} categories.`
  );
  console.log(`Live Wix image groups: ${live.groups.length}`);

  const measured = [];
  if (live.groups.length) {
    console.log("Downloading unique images to record pixel size. No upload and no row writes in an audit.");
    for (const group of live.groups) {
      console.log(`\n${group.kind}: ${group.canonical}`);
      const size = args.apply ? { note: "measured during apply" } : await measureGroup(group);
      if (!args.apply) {
        console.log(
          size.downloadError
            ? `  DOWNLOAD FAILED: ${size.downloadError}`
            : `  ${size.sourceWidth}x${size.sourceHeight} ${size.sourceFormat} ${size.sourceBytes} bytes`
        );
      }
      measured.push({ ...summariseGroup(group), ...size });
    }
  }

  const scriptOnly = live.repo.hits.filter((hit) => !hit.runtime);
  const inventory = {
    auditedAt: new Date().toISOString(),
    mode: args.apply ? "apply-prescan" : "audit",
    postsScanned: live.posts.length,
    authorsScanned: live.authors.length,
    booksScanned: live.books.length,
    imageGroups: measured,
    scriptOnlyReferences: scriptOnly.map((hit) => ({ file: hit.file, url: hit.url })),
    nonImageMentions: {
      database: live.mentions,
      repo: live.repo.mentions,
    },
  };
  const inventoryName = args.apply ? "apply-prescan.json" : "inventory.json";
  const inventoryPath = path.join(BACKUP_DIR, inventoryName);
  if (!args.apply) {
    try {
      await access(inventoryPath);
      const stamped = path.join(BACKUP_DIR, `inventory-${Date.now()}.json`);
      await writeFile(stamped, JSON.stringify(inventory, null, 2));
      console.log(`\nInventory already existed. Wrote a new copy without overwriting it: ${stamped}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
      console.log(`\nWrote inventory: ${inventoryPath}`);
    }
  } else {
    await writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
  }

  if (!args.apply) return;
  if (!live.groups.length) {
    console.log("No live Wix image URLs. Nothing uploaded.");
    return;
  }

  console.log("\nUploading verified graphics...");
  const urlMap = new Map();
  const results = [];
  let bytesAdded = 0;
  for (const group of live.groups) {
    console.log(`\nMigrate ${group.kind}: ${group.canonical}`);
    try {
      const stored = await optimiseAndStore(supabase, supabaseUrl, group, progress);
      if (!stored.ok) {
        console.warn(`  LEFT UNCHANGED: ${stored.error}`);
        await logProgress({ event: "left-unchanged", key: group.key, error: stored.error });
        results.push({ ...summariseGroup(group), ok: false, error: stored.error });
        continue;
      }
      if (stored.uploaded) bytesAdded += stored.bytes;
      for (const url of group.exactUrls) urlMap.set(url, stored.publicUrl);
      results.push({
        ...summariseGroup(group),
        ok: true,
        filename: stored.filename,
        publicUrl: stored.publicUrl,
        httpStatus: stored.httpStatus,
        contentType: stored.contentType,
        bytes: stored.bytes,
        storedBytes: stored.storedBytes,
        uploaded: stored.uploaded,
        width: stored.width,
        height: stored.height,
        sourceWidth: stored.sourceWidth,
        sourceHeight: stored.sourceHeight,
        encode: stored.encode,
      });
      console.log(
        `  ${stored.uploaded ? "uploaded" : "reused"} ${stored.width}x${stored.height} ${stored.encode} HTTP ${stored.httpStatus} ${stored.contentType}`
      );
    } catch (error) {
      const message = redact(error.message);
      console.warn(`  LEFT UNCHANGED: ${message}`);
      await logProgress({ event: "left-unchanged", key: group.key, error: message });
      results.push({ ...summariseGroup(group), ok: false, error: message });
    }
  }

  const rowUpdates = [];
  if (urlMap.size) {
    console.log("\nUpdating rows that contain a verified URL...");
    const tables = ["posts", "authors", "books"];
    for (const table of tables) {
      const rows = live[table];
      for (const row of rows) {
        try {
          const payloadPreview = replacementPayload(row, table, urlMap);
          if (!Object.keys(payloadPreview).length) continue;
          const updated = await updateOneRow(supabase, table, row, urlMap);
          rowUpdates.push({ table, ...updated });
          if (updated.updated) {
            console.log(`  updated ${table} ${updated.slug}: ${updated.fields.join(", ")}`);
            progress.rows[`${table}:${updated.slug}`] = {
              status: "updated",
              fields: updated.fields,
              at: new Date().toISOString(),
            };
            await saveProgress(progress);
            await logProgress({ event: "row-updated", table, slug: updated.slug, fields: updated.fields });
          }
        } catch (error) {
          const message = redact(error.message);
          console.warn(`  ROW FAILED ${table} ${row.slug}: ${message}`);
          rowUpdates.push({ table, slug: row.slug, updated: false, error: message });
          await logProgress({ event: "row-failed", table, slug: row.slug, error: message });
        }
      }
    }
  } else {
    console.log("\nNo verified replacement URL. No rows were written.");
  }

  const codeUpdates = [];
  if (urlMap.size) {
    for (const hit of live.repo.hits.filter((item) => item.runtime)) {
      if (![...urlMap.keys()].some((url) => hit.url === url)) continue;
      const absolute = path.join(projectRoot, hit.file);
      const original = await readFile(absolute, "utf8");
      const next = replaceExactUrls(original, urlMap);
      if (next === original) continue;
      assertOnlyUrlsChanged(original, next, [...urlMap.keys()], [...new Set(urlMap.values())]);
      await backupFile(hit.file, original);
      await writeFile(absolute, next);
      codeUpdates.push(hit.file);
      progress.files[hit.file] = { status: "updated", at: new Date().toISOString() };
      await saveProgress(progress);
      await logProgress({ event: "file-updated", file: hit.file });
      console.log(`  updated file ${hit.file}`);
    }
  }

  console.log("\nValidating...");
  const validation = await validate(supabase, supabaseUrl, progress);
  const report = {
    finishedAt: new Date().toISOString(),
    bytesAdded,
    results,
    rowsUpdated: rowUpdates.filter((item) => item.updated),
    rowFailures: rowUpdates.filter((item) => item.error),
    codeFilesUpdated: [...new Set(codeUpdates)],
    typecheck: codeUpdates.length ? "pending" : "not-run (no website code changed)",
    validation: {
      postsScanned: validation.postsScanned,
      remainingImageGroups: validation.remainingImageGroups,
      remainingImageOccurrences: validation.remainingImageOccurrences,
      scriptOnlyUrlFiles: validation.scriptOnlyUrlFiles,
      nonImageMentions: validation.nonImageMentions,
      heads: validation.heads,
    },
  };
  await writeFile(path.join(BACKUP_DIR, "final-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    bytesAdded: report.bytesAdded,
    migrated: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    rowsUpdated: report.rowsUpdated.length,
    codeFilesUpdated: report.codeFilesUpdated,
    remainingImageGroups: validation.remainingImageGroups.length,
    typecheck: report.typecheck,
  }, null, 2));
}

main().catch((error) => {
  console.error(redact(error?.stack || error?.message || error));
  process.exitCode = 1;
});
