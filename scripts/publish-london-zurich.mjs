/**
 * Publish "London to Zürich by Train via Lake Constance".
 *
 * Images stay in public/images/blog/london-to-zurich-via-lake-constance/
 *
 * Usage:
 *   node scripts/publish-london-zurich.mjs --dry-run
 *   node scripts/publish-london-zurich.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\London to Zürich by Train via Lake Constance.docx";

const SLUG = "london-to-zurich-by-train-via-strasbourg-and-lake-constance";
const TITLE =
  "London to Zürich by Train: Take the Long Way via Strasbourg and Lake Constance";
const EXCERPT =
  "A five-day flight-free journey from London to Zürich via Lille, Strasbourg, the Black Forest and Lake Constance, returning by train through Paris.";
const CATEGORIES = ["france", "switzerland", "scenicroutes"];
const PUBLISHED_AT = "2026-09-26";
const IMAGE_DIR = "/images/blog/london-to-zurich-via-lake-constance";

const H2 = new Set([
  "Why Do This Journey?",
  "The Five-Day Journey",
  "Day 1: London to Strasbourg Without Crossing Paris",
  "Day 2: Strasbourg to Lake Constance Through the Black Forest",
  "Day 3: A Full Day on Lake Constance",
  "Day 4: Lake Constance to Zürich",
  "Day 5: Zürich Properly",
  "Don't Fly Home: Zürich to Paris by Train",
  "Can You Travel Zürich to London in One Day?",
  "How to Book the Journey Independently",
  "What About an Interrail Pass?",
  "When Should You Do This Journey?",
  "The Journey at a Glance",
  "Why This Journey Works",
  "Keep Going Through France and Switzerland",
]);

const H3 = new Set([
  "An Important Booking Tip",
  "Arriving in Strasbourg",
  "Where to Stay in Strasbourg",
  "Where to Eat in Strasbourg",
  "Strasbourg to Offenburg",
  "The Black Forest Railway",
  "Arrival in Konstanz",
  "Where to Stay in Konstanz",
  "Where to Eat in Konstanz",
  "Cross Lake Constance by Ferry",
  "Meersburg",
  "Another Option: Mainau Island",
  "Back to Konstanz",
  "First Afternoon in Zürich",
  "Where to Stay in Zürich",
  "Where to Eat in Zürich",
  "Take the Train Up Uetliberg",
  "Book the Long-Distance Trains First",
  "Don't Overbook the Black Forest Section",
]);

const PHOTOS = [
  {
    file: "Strasbourg at Sunrise.jpg",
    alt: "Sunrise over Strasbourg, with the cathedral spire above the old city",
  },
  {
    file: "Strasbourg.jpg",
    alt: "Half-timbered houses and canals in Strasbourg's Petite France",
  },
  {
    file: "Train through Black Forest near Lake Constance .jpg",
    alt: "A train travelling through wooded hills near Lake Constance",
  },
  {
    file: "Lake Constance.jpg",
    alt: "The shore of Lake Constance, with the Alps beyond the water",
  },
  {
    file: "Meersburg on Shore of Lake Constance.jpg",
    alt: "Meersburg and its vineyards on the shore of Lake Constance",
  },
  {
    file: "Zurich View Over River Limmat.jpg",
    alt: "Zürich and the River Limmat, seen from above the old town",
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicSrc(file) {
  return encodeURI(`${IMAGE_DIR}/${file}`).replace(/#/g, "%23");
}

function cleanUrl(href) {
  const url = new URL(href);
  url.searchParams.delete("utm_source");
  url.searchParams.delete("utm_medium");
  url.searchParams.delete("utm_campaign");
  return url.toString();
}

function link(href, text) {
  return `<a href="${escapeHtml(cleanUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function figure(photo) {
  return `<figure><img src="${escapeHtml(publicSrc(photo.file))}" alt="${escapeHtml(photo.alt)}" loading="lazy" decoding="async" /></figure>`;
}

function applyLinks(text, links) {
  let html = escapeHtml(text);
  for (const item of links) {
    const safe = escapeHtml(item.text);
    const anchor = link(item.href, item.text);
    const at = html.lastIndexOf(safe);
    if (at === -1) continue;
    html = html.slice(0, at) + anchor + html.slice(at + safe.length);
  }
  return html;
}

function readDocxBlocks(docxPath) {
  const buf = readFileSync(docxPath);
  const unzip = unzipDocx(buf);
  const xml = unzip["word/document.xml"].toString("utf8");
  const rels = unzip["word/_rels/document.xml.rels"].toString("utf8");
  const relMap = {};
  for (const match of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap[match[1]] = decodeURIComponent(match[2]);
  }
  const body = xml.match(/<w:body[\s\S]*<\/w:body>/)[0];
  const blocks = [];
  for (const block of body.split(/<w:p[ >]/).slice(1)) {
    const links = [...block.matchAll(/<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g)].map(
      (match) => ({
        text: [...match[2].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
          .map((part) => decodeXml(part[1]))
          .join(""),
        href: relMap[match[1]] || match[1],
      })
    );
    const images = [...block.matchAll(/r:embed="([^"]+)"/g)].map(
      (match) => relMap[match[1]] || match[1]
    );
    const withBreaks = block.replace(/<w:br\b[^>]*\/?>/g, "<w:t>\n</w:t>");
    const text = [...withBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
    if (!text && !images.length && !links.length) continue;
    blocks.push({ text, links, images });
  }
  return blocks;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function unzipDocx(buffer) {
  const files = {};
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.slice(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buffer.slice(dataStart, dataStart + compressed);
    if (name && !name.endsWith("/")) {
      files[name] = method === 0 ? data : inflateRaw(data);
    }
    offset = dataStart + compressed;
  }
  return files;
}

function inflateRaw(data) {
  return inflateRawSync(data);
}

function buildBody(blocks) {
  const parts = [];
  let photo = 0;
  for (const block of blocks) {
    if (block.images.length) {
      const image = PHOTOS[photo];
      photo += 1;
      if (!image) throw new Error("More images in the document than supplied photographs");
      if (photo === 1) continue;
      parts.push(figure(image));
      continue;
    }

    const text = block.text.trim();
    if (!text || text === TITLE) continue;

    if (H2.has(text)) {
      parts.push(`<h2>${escapeHtml(text)}</h2>`);
      continue;
    }
    if (H3.has(text)) {
      parts.push(`<h3>${escapeHtml(text)}</h3>`);
      continue;
    }

    if (
      block.links.length > 1 &&
      text.replace(/\s+/g, "") === block.links.map((item) => item.text).join("")
    ) {
      const items = block.links
        .map((item) => `<li>${link(item.href, item.text)}</li>`)
        .join("");
      parts.push(`<ul>${items}</ul>`);
      continue;
    }

    if (text.startsWith("Day 1:") && text.includes("Day 2:")) {
      const days = text.split(/(?=Day \d+:)/).map((day) => day.trim()).filter(Boolean);
      parts.push(`<ul>${days.map((day) => `<li>${escapeHtml(day)}</li>`).join("")}</ul>`);
      continue;
    }

    let html = applyLinks(text, block.links).replace(/\n/g, "<br>");
    if (text.includes("Our Touring France by Train and Touring Switzerland by Train guides")) {
      html = html
        .replace(
          "Touring France by Train",
          link("https://mybook.to/TouringFranceByTrain", "Touring France by Train")
        )
        .replace(
          "Touring Switzerland by Train",
          link("https://mybook.to/SwitzerlandByTrain", "Touring Switzerland by Train")
        );
      parts.push(`<p>${html}</p>`);
      parts.push(`<p>${link("https://mybook.to/TouringFranceByTrain", "Discover Touring France by Train")}</p>`);
      parts.push(
        `<p>${link("https://mybook.to/SwitzerlandByTrain", "Discover Touring Switzerland by Train")}</p>`
      );
      parts.push("<p>Or explore the complete Real Travel Guides collection:</p>");
      parts.push(
        `<p>${link("https://mybook.to/RealTravelGuidesBooks", "Explore our Touring by Train guides")}</p>`
      );
      continue;
    }

    parts.push(`<p>${html}</p>`);
  }

  if (photo !== PHOTOS.length) {
    throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
  }
  return parts.join("\n");
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function assertImagesExist() {
  const missing = PHOTOS.filter(
    (photo) =>
      !existsSync(
        path.join("public", "images", "blog", "london-to-zurich-via-lake-constance", photo.file)
      )
  );
  if (missing.length) {
    throw new Error(`Missing image files:\n${missing.map((photo) => `  - ${photo.file}`).join("\n")}`);
  }
}

async function main() {
  assertImagesExist();
  const blocks = readDocxBlocks(DOC);
  const body = buildBody(blocks);
  const record = {
    slug: SLUG,
    title: TITLE,
    excerpt: EXCERPT,
    cover: publicSrc(PHOTOS[0].file),
    categories: CATEGORIES,
    read_minutes: estimateReadMinutes(body),
    published_at: PUBLISHED_AT,
    body,
    images: null,
  };

  console.log(`Title: ${record.title}`);
  console.log(`Slug: ${record.slug}`);
  console.log(`Cover: ${record.cover}`);
  console.log(`Categories: ${record.categories.join(", ")}`);
  console.log(`Read minutes: ${record.read_minutes}`);
  console.log(`France link: ${body.includes("mybook.to/TouringFranceByTrain")}`);
  console.log(`Switzerland link: ${body.includes("mybook.to/SwitzerlandByTrain")}`);
  console.log(`Figures: ${(body.match(/<figure>/g) || []).length}`);
  console.log(`ChatGPT tracking left: ${body.includes("utm_source=chatgpt.com")}`);

  if (DRY_RUN) {
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: existing, error: lookupError } = await supabase
    .from("posts")
    .select("slug")
    .eq("slug", SLUG)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) throw new Error(`Post already exists: ${SLUG}`);

  const { error } = await supabase.from("posts").insert(record);
  if (error) throw error;
  console.log(`\nPublished /post/${SLUG}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
