/**
 * Adds one or more local image files as in-article "managed images" to an
 * existing post — the mechanism page.tsx's injectManagedImages() already
 * expects (the `images` jsonb column: an array of {src, alt, caption}).
 * These render inline in the article body, in addition to the post's
 * `cover` (hero) image, which this script never touches.
 *
 * Setup: same .env.local as migrate-posts.mjs
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage:
 *   node scripts/add-content-image.mjs --slug=paris-to-nice-by-night-train-the-civilised-way-to-reach-the-riviera --image="C:\path\to\Nice.jpg" --alt="Promenade des Anglais, Nice" --caption="The Promenade des Anglais on a summer afternoon"
 *
 *   --slug       required. The post's exact slug in Supabase.
 *   --image      required. Local path to the image file. Repeat --image to
 *                add several at once (each gets its own alt/caption prompt
 *                skipped — pass --alt/--caption once, applied to all, or
 *                omit and edit captions later in Supabase).
 *   --alt        optional. Alt text (accessibility + SEO). Defaults to the
 *                post's title if omitted.
 *   --caption    optional. Caption shown under the image. Omit for none.
 *   --dry-run    resize/inspect only, no upload or DB write.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";

dotenv.config({ path: ".env.local" });

const POST_IMAGES_BUCKET = "post-images";
// In-article images render inline in text, not full-width like a cover —
// 1600px is comfortably larger than they'll ever display at.
const CONTENT_MAX_DIMENSION = 1600;
const CONTENT_JPEG_QUALITY = 80;

function parseArgs(argv) {
  const args = { image: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg.startsWith("--slug=")) {
      args.slug = arg.slice("--slug=".length);
    } else if (arg.startsWith("--image=")) {
      args.image.push(arg.slice("--image=".length));
    } else if (arg.startsWith("--alt=")) {
      args.alt = arg.slice("--alt=".length);
    } else if (arg.startsWith("--caption=")) {
      args.caption = arg.slice("--caption=".length);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.slug) throw new Error("Missing required --slug=<post-slug>");
  if (!args.image.length) throw new Error("Missing required --image=<local-file-path> (repeat for multiple)");

  if (!args.dryRun) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing Supabase credentials. Create .env.local with:\n" +
          "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
          "  SUPABASE_SERVICE_ROLE_KEY=..."
      );
    }
  }

  const supabase = args.dryRun
    ? null
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let post = null;
  if (!args.dryRun) {
    const { data, error } = await supabase
      .from("posts")
      .select("slug, title, images")
      .eq("slug", args.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No post found with slug "${args.slug}" — check it matches exactly.`);
    post = data;
    console.log(`Found post: "${post.title}"`);
    console.log(`Currently has ${Array.isArray(post.images) ? post.images.length : 0} managed image(s).`);
  }

  const newEntries = [];

  for (const localPath of args.image) {
    console.log(`\nProcessing: ${localPath}`);
    const fileBuffer = await readFile(localPath);
    const resized = await sharp(fileBuffer)
      .resize({
        width: CONTENT_MAX_DIMENSION,
        height: CONTENT_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: CONTENT_JPEG_QUALITY })
      .toBuffer();

    console.log(`  Resized: ${fileBuffer.length} bytes -> ${resized.length} bytes`);

    if (args.dryRun) {
      console.log(`  [dry-run] Would upload and attach to post "${args.slug}".`);
      continue;
    }

    const storagePath = `content/${args.slug}-${randomUUID().slice(0, 8)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(POST_IMAGES_BUCKET)
      .upload(storagePath, resized, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(storagePath);
    console.log(`  Uploaded: ${urlData.publicUrl}`);

    newEntries.push({
      src: urlData.publicUrl,
      alt: args.alt || post.title,
      caption: args.caption || "",
    });
  }

  if (args.dryRun) {
    console.log("\nDry run complete — nothing uploaded or written.");
    return;
  }

  const existing = Array.isArray(post.images) ? post.images : [];
  const updatedImages = [...existing, ...newEntries];

  const { error: updateError } = await supabase
    .from("posts")
    .update({ images: updatedImages })
    .eq("slug", args.slug);
  if (updateError) throw updateError;

  console.log(`\nDone. Post "${args.slug}" now has ${updatedImages.length} managed image(s).`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
