/**
 * Attach images from a local zip to matching posts (cover if missing,
 * remaining files as managed in-article images).
 *
 *   node scripts/apply-zip-images.mjs --dry-run
 *   node scripts/apply-zip-images.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

dotenv.config({ path: ".env.local" });

const POST_IMAGES_BUCKET = "post-images";
const CONTENT_MAX = 1600;
const COVER_MAX = 2000;
const JPEG_QUALITY = 80;
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_SLUGS = process.argv
  .filter((a) => a.startsWith("--slug="))
  .map((a) => a.slice("--slug=".length));
const ZIP_PATH =
  process.argv.find((a) => a.startsWith("--zip="))?.slice("--zip=".length) ||
  "C:\\Users\\gille\\Documents\\Real Travel Guides\\RTG IMAGES TO COPY.zip";

const GROUPS = [
  {
    slug: "hospices-de-beaune-burgundy-s-most-remarkable-building-and-the-perfect-rail-day-trip",
    test: (name) => /hospices de beaune/i.test(name),
    coverHint: /external/i,
  },
  {
    slug: "san-vito-lo-capo-sicily-s-most-beautiful-coastline-without-hiring-a-car",
    test: (name) => /san vito/i.test(name),
    coverHint: /san vito beach\s*\./i,
  },
  {
    slug: "locarno-by-train-switzerland-s-most-atmospheric-lakeside-town",
    test: (name) => /locarno/i.test(name),
    coverHint: /maggiore|lake/i,
  },
  {
    slug: "palazzo-butera-palermo-s-most-surprising-museum-where-baroque-meets-the-unexpected",
    test: (name) => /palazzo butara/i.test(name),
    coverHint: /stairs/i,
  },
  {
    slug: "palermo-beyond-the-obvious-part-2-a-palace-of-power-silence-and-stories-that-haven-t-faded",
    test: (name) => /palazzo steri/i.test(name),
    coverHint: /main hall/i,
  },
  {
    slug: "the-norman-palace-and-palatine-chapel-palermo-sicily-s-most-extraordinary-interior",
    test: (name) => /norman palace/i.test(name),
    coverHint: /nave/i,
  },
  {
    slug: "is-this-the-world-s-most-beautiful-cathedral-discovering-monreale-cathedral-above-palermo",
    test: (name) => /monreale/i.test(name),
    coverHint: /monreale-cathedral-mosaics\.jpg$/i,
  },
  {
    slug: "spring-walking-escape-on-the-massa-lubrense-peninsula",
    test: (name) => /massa lubrense/i.test(name),
    coverHint: /view of capri/i,
  },
  {
    slug: "sorrento-weekend-spring-2026-how-to-plan-the-perfect-coastal-escape-by-train",
    test: (name) => /sorrento/i.test(name),
    coverHint: /sorrento 1/i,
  },
  {
    slug: "escape-the-carnival-crowds-a-quiet-morning-at-san-nicolò-dei-mendicoli-dorsoduro",
    test: (name) => /san nicolo|san nicolò|dosoduro/i.test(name),
  },
  {
    slug: "truffle-brunello-weekend-from-florence-san-miniato-montalcino-by-train",
    test: (name) => /tuscan winery/i.test(name),
    coverHint: /sunset/i,
  },
];

function storageKeyPart(slug) {
  return slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/gi, "-");
}

function captionFromFilename(filePath) {
  return path
    .basename(filePath)
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function listImageFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listImageFiles(full)));
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function coverLooksPresent(cover) {
  if (!cover) return false;
  if (/^https?:\/\//i.test(cover)) return true;
  return true;
}

async function localCoverExists(cover) {
  if (!cover || /^https?:\/\//i.test(cover)) return Boolean(cover);
  const relative = cover.replace(/^\//, "");
  try {
    const info = await stat(path.join(process.cwd(), relative));
    return info.size > 50_000;
  } catch {
    return false;
  }
}

async function resizeJpeg(fileBuffer, max) {
  return sharp(fileBuffer)
    .rotate()
    .resize({
      width: max,
      height: max,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

function extractZip(zipPath, destDir) {
  execFileSync(
    "tar",
    ["-xf", zipPath, "-C", destDir],
    { stdio: "inherit", windowsHide: true }
  );
}

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  if (!DRY_RUN && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "rtg-images-"));
  console.log(`Extracting zip to ${tmp}`);
  extractZip(ZIP_PATH, tmp);

  const files = await listImageFiles(tmp);
  console.log(`Found ${files.length} image files.`);

  const assigned = new Set();
  const groups = GROUPS.filter((group) => !ONLY_SLUGS.length || ONLY_SLUGS.includes(group.slug)).map((group) => {
    const matched = files.filter((file) => group.test(path.basename(file)));
    matched.forEach((file) => assigned.add(file));
    const ordered = [...matched].sort((a, b) => {
      const aCover = group.coverHint?.test(path.basename(a)) ? 0 : 1;
      const bCover = group.coverHint?.test(path.basename(b)) ? 0 : 1;
      if (aCover !== bCover) return aCover - bCover;
      return path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true });
    });
    return { ...group, files: ordered };
  });

  const unused = files.filter((file) => !assigned.has(file));
  if (unused.length) {
    console.log("Unmatched files:");
    unused.forEach((file) => console.log("  -", path.basename(file)));
  }

  const supabase = DRY_RUN
    ? null
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  for (const group of groups) {
    if (!group.files.length) {
      console.log(`\nSKIP ${group.slug} — no matching files`);
      continue;
    }

    let post = { title: group.slug, cover: "", images: [] };
    if (!DRY_RUN) {
      const { data, error } = await supabase
        .from("posts")
        .select("slug,title,cover,images")
        .eq("slug", group.slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        console.log(`\nSKIP missing post ${group.slug}`);
        continue;
      }
      post = data;
    }

    const hasCover = await localCoverExists(post.cover);
    console.log(`\n${post.title}`);
    console.log(`  ${group.files.length} file(s); cover ${hasCover ? "OK" : "MISSING"}`);

    const newImages = [];
    let newCover = null;

    for (const [index, file] of group.files.entries()) {
      const caption = captionFromFilename(file);
      const useAsCover = !hasCover && index === 0;
      const max = useAsCover ? COVER_MAX : CONTENT_MAX;
      const original = await readFile(file);
      const resized = await resizeJpeg(original, max);
      console.log(`  ${useAsCover ? "COVER" : "BODY "} ${path.basename(file)} (${resized.length} bytes)`);

      if (DRY_RUN) continue;

      const folder = useAsCover ? "covers" : "content";
      const storagePath = `${folder}/${storageKeyPart(group.slug)}-${randomUUID().slice(0, 8)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(POST_IMAGES_BUCKET)
        .upload(storagePath, resized, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(storagePath);

      if (useAsCover) {
        newCover = urlData.publicUrl;
      } else {
        newImages.push({
          src: urlData.publicUrl,
          alt: `${post.title} — ${caption}`,
          caption,
        });
      }
    }

    if (DRY_RUN) continue;

    const existing = Array.isArray(post.images) ? post.images : [];
    const payload = { images: [...existing, ...newImages] };
    if (newCover) payload.cover = newCover;

    const { error: updateError } = await supabase.from("posts").update(payload).eq("slug", group.slug);
    if (updateError) throw updateError;
    console.log(`  Saved ${payload.images.length} managed image(s)${newCover ? " + new cover" : ""}`);
  }

  await rm(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
