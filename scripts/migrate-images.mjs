/**
 * Downloads the site's core images (hero, book covers, author photos) from
 * Wix's CDN into public/images/. These 7 URLs were pulled by hand from the
 * live site's pages — unlike migrate-posts.mjs, there's no feed to crawl
 * here since it's a small, fixed set of known images.
 *
 * Uses each image's base Wix media URL (without the /v1/fill/w_..,h_..
 * suffix) to get the original full-resolution upload rather than the small
 * cropped thumbnail Wix generates for a specific page layout.
 *
 * Usage:
 *   node scripts/migrate-images.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

const IMAGES = [
  // Note: logo.png is NOT downloaded here — it's the real high-res logo
  // shipped directly in the repo at public/images/logo.png. Don't add a
  // Wix-sourced entry for it here, or a re-run would overwrite it with the
  // old site's low-res 65x75 icon version.
  {
    url: "https://static.wixstatic.com/media/fef05b_b18df15a486f4ba2a9fc37db6e3bd998~mv2.jpg",
    dest: "public/images/hero.jpg",
  },
  {
    url: "https://static.wixstatic.com/media/fef05b_7808a3b36fac43889e782f21db95e0f6~mv2.jpg",
    dest: "public/images/books/touring-italy-by-train.jpg",
  },
  {
    url: "https://static.wixstatic.com/media/fef05b_c7fea9ffe01e4b32a9e9b6d7db6bdc47~mv2.png",
    dest: "public/images/books/touring-switzerland-by-train.png",
  },
  {
    url: "https://static.wixstatic.com/media/fef05b_7d2f3978b9b14eadb930dd494531edef~mv2.png",
    dest: "public/images/books/touring-spain-by-train.png",
  },
  {
    url: "https://static.wixstatic.com/media/fef05b_8e8fa1e9371642b9a98418eddacd3076~mv2.jpg",
    dest: "public/images/books/touring-france-by-train.jpg",
  },
  {
    url: "https://static.wixstatic.com/media/00354b_a6d9de5ca09b4f7c9f6a9e1206146d32~mv2.jpg",
    dest: "public/images/authors/elena-rossetti.jpg",
  },
  {
    url: "https://static.wixstatic.com/media/5f33fc_2c879f00e4854d42921719d1de1fde65~mv2.jpeg",
    dest: "public/images/authors/sophie-picot.jpg",
  },
];

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buffer);
  return buffer.length;
}

async function main() {
  console.log(`Downloading ${IMAGES.length} images...\n`);
  let ok = 0;
  const failed = [];

  for (const { url, dest } of IMAGES) {
    const destPath = path.join(process.cwd(), dest);
    try {
      const bytes = await downloadImage(url, destPath);
      console.log(`  OK  ${dest}  (${(bytes / 1024).toFixed(0)} KB)`);
      ok++;
    } catch (err) {
      console.error(`FAIL  ${dest}  ${err.message}`);
      failed.push(dest);
    }
  }

  console.log(`\nDone. ${ok}/${IMAGES.length} downloaded.`);
  if (failed.length) {
    console.log("Failed:");
    failed.forEach((d) => console.log(`  - ${d}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
