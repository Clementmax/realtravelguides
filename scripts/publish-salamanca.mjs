/**
 * Publish "Salamanca from Madrid by Train: The Day Trip That Deserves a Night".
 *
 * Images stay in public/images/blog/salamanca-from-madrid-by-train/
 *
 * Usage:
 *   node --use-system-ca scripts/publish-salamanca.mjs --dry-run
 *   node --use-system-ca scripts/publish-salamanca.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Salamanca from Madrid by Train.docx";

const SLUG = "salamanca-from-madrid-by-train";
const TITLE = "Salamanca from Madrid by Train: The Day Trip That Deserves a Night";
const EXCERPT =
  "A two-day rail itinerary from Madrid to Salamanca: university courtyards, two cathedrals, a hidden convent, the Roman Bridge and why this sandstone city deserves a night.";
const CATEGORIES = ["spain", "culture"];
const PUBLISHED_AT = "2026-09-27";
const IMAGE_DIR = "/images/blog/salamanca-from-madrid-by-train";
const COVER = `${IMAGE_DIR}/salamanca-view-from-roman-bridge-social.jpg`;

const H2 = new Set([
  "Why Salamanca?",
  "Getting from Madrid to Salamanca by Train",
  "Day 1: Begin in Plaza Mayor",
  "Why You Should Stay the Night",
  "Where to Eat in Salamanca",
  "Where to Stay in Salamanca",
  "Day 2: Salamanca Beyond the Essentials",
  "Can You Visit Salamanca as a Day Trip?",
  "Where to Stay in Madrid",
  "Booking the Journey",
  "The Perfect Overnight Escape from Madrid",
  "Explore More of Spain by Train",
]);

const H3 = new Set([
  "The University of Salamanca: Look Beyond the Frog",
  "Step Inside the University",
  "Casa de las Conchas",
  "Lunch Like a Salmantino",
  "Two Cathedrals for the Price of One",
  "Don't Miss Ieronimus",
  "A Hidden Salamanca: Convento de las Dueñas",
  "Cakes from the Nuns",
  "Huerto de Calixto y Melibea",
  "Cross the Roman Bridge",
  "One More Hidden Corner",
  "Lunch Before the Train",
]);

/** Each photo is placed after the paragraph starting with `after`. */
const PHOTOS = [
  {
    after: "Completed during the 18th century, Salamanca's great Baroque square is the city's living room rather than simply a monument.",
    file: "plaza-mayor-salamanca.jpeg",
    alt: "Salamanca's Plaza Mayor, with its arcaded sandstone façades under a blue sky",
  },
  {
    after: "The university is worth visiting inside precisely because the rooms remind you that this wasn't simply a palace — people actually studied and argued here.",
    file: "university-of-salamanca-corridor.jpg",
    alt: "Sunlight falling through the arched windows of a gallery inside the University of Salamanca",
  },
  {
    after: "More than 300 stone scallop shells cover the façade of this late-15th-century palace.",
    file: "casa-de-las-conchas-salamanca.jpg",
    alt: "Carved stone scallop shells covering the façade of the Casa de las Conchas",
  },
  {
    after: "Inside the Old Cathedral, look for the beautiful Romanesque-Gothic dome known as the Torre del Gallo.",
    file: "main-alterpiece-salamanca-cathedral.jpeg",
    alt: "The painted main altarpiece in Salamanca's Old Cathedral",
  },
  {
    after: "Look carefully and there are other curious carvings to discover too.",
    file: "cathedral-of-salamanca-interior.jpg",
    alt: "The soaring Gothic nave of Salamanca's New Cathedral",
  },
  {
    after: "Ieronimus allows you to climb through the cathedral towers and upper galleries.",
    file: "tower-salamanca-cathedral.jpeg",
    alt: "A bell inside one of Salamanca Cathedral's towers on the Ieronimus route",
  },
  {
    after: "Look closely at the capitals and stonework and you'll find an extraordinary collection of foliage, human figures, fantastic creatures and grotesques.",
    file: "convento-de-las-duenas-salamanca.jpg",
    alt: "The upper gallery of the Renaissance cloister at the Convento de las Dueñas, with its carved capitals",
  },
  {
    after: "Look through the arches towards the cathedral.",
    file: "convento-de-las-duenas-with-salamanca-cathedral-behind.jpg",
    alt: "The cloister of the Convento de las Dueñas, with the dome of Salamanca's New Cathedral rising behind",
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanUrl(href) {
  const url = new URL(href);
  if (!url.searchParams.has("utm_source")) return href;
  url.searchParams.delete("utm_source");
  return url.toString();
}

function link(href, text) {
  return `<a href="${escapeHtml(cleanUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function figure(photo) {
  return `<figure><img src="${escapeHtml(`${IMAGE_DIR}/${photo.file}`)}" alt="${escapeHtml(photo.alt)}" loading="lazy" decoding="async" /></figure>`;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
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
      files[name] = method === 0 ? data : inflateRawSync(data);
    }
    offset = dataStart + compressed;
  }
  return files;
}

function runsOf(xml, href = null) {
  return [...xml.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].map((match) => {
    const run = match[0];
    const props = (run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
    const bold = /<w:b\/>|<w:b w:val="(1|true|on)"\/>/.test(props);
    const text = run
      .replace(/<w:br\b[^>]*\/?>/g, "<w:t>\n</w:t>")
      .matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
    return { bold, href, text: [...text].map((part) => decodeXml(part[1])).join("") };
  });
}

/** Paragraphs as run lists; hyperlink runs carry their target. */
function readDocxParagraphs(docxPath) {
  const unzip = unzipDocx(readFileSync(docxPath));
  const xml = unzip["word/document.xml"].toString("utf8");
  const rels = unzip["word/_rels/document.xml.rels"].toString("utf8");
  const relMap = {};
  for (const match of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap[match[1]] = decodeXml(match[2]);
  }
  const body = xml.match(/<w:body[\s\S]*<\/w:body>/)[0];
  const paragraphs = [];
  for (const block of body.split(/<w:p[ >]/).slice(1)) {
    const runs = [];
    const pattern = /<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g;
    let last = 0;
    for (const match of block.matchAll(pattern)) {
      runs.push(...runsOf(block.slice(last, match.index)));
      runs.push(...runsOf(match[2], relMap[match[1]] || match[1]));
      last = match.index + match[0].length;
    }
    runs.push(...runsOf(block.slice(last)));
    const text = runs.map((run) => run.text).join("");
    if (!text.trim()) continue;
    paragraphs.push({ runs, text: text.trim() });
  }
  return paragraphs;
}

function paragraphHtml(runs) {
  const segments = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = segments[segments.length - 1];
    if (prev && prev.bold === run.bold && prev.href === run.href) prev.text += run.text;
    else segments.push({ ...run });
  }
  const html = segments
    .map((seg) => {
      if (seg.href) return link(seg.href, seg.text.trim());
      const text = escapeHtml(seg.text).replace(/\n/g, "<br>");
      if (!seg.bold || !seg.text.trim()) return text;
      const lead = text.match(/^\s*/)[0];
      const tail = text.match(/\s*$/)[0];
      return `${lead}<strong>${text.trim()}</strong>${tail}`;
    })
    .join("");
  return html.trim();
}

function buildBody(paragraphs) {
  const parts = [];
  const placed = new Set();
  for (const para of paragraphs) {
    const { text } = para;
    if (text === TITLE) continue;

    if (H2.has(text)) {
      parts.push(`<h2>${escapeHtml(text)}</h2>`);
      continue;
    }
    if (H3.has(text)) {
      parts.push(`<h3>${escapeHtml(text)}</h3>`);
      continue;
    }

    parts.push(`<p>${paragraphHtml(para.runs)}</p>`);

    for (const photo of PHOTOS) {
      if (!placed.has(photo) && text.startsWith(photo.after)) {
        parts.push(figure(photo));
        placed.add(photo);
      }
    }
  }

  const missing = PHOTOS.filter((photo) => !placed.has(photo));
  if (missing.length) {
    throw new Error(`Unplaced photos:\n${missing.map((photo) => `  - ${photo.file}`).join("\n")}`);
  }
  const headings = (parts.join("\n").match(/<h[23]>/g) || []).length;
  if (headings !== H2.size + H3.size) {
    throw new Error(`Expected ${H2.size + H3.size} headings, matched ${headings}`);
  }
  return parts.join("\n");
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function assertImagesExist() {
  const files = [...PHOTOS.map((photo) => photo.file), path.basename(COVER)];
  const missing = files.filter(
    (file) => !existsSync(path.join("public", "images", "blog", SLUG, file))
  );
  if (missing.length) {
    throw new Error(`Missing image files:\n${missing.map((file) => `  - ${file}`).join("\n")}`);
  }
}

async function main() {
  assertImagesExist();
  const body = buildBody(readDocxParagraphs(DOC));
  const record = {
    slug: SLUG,
    title: TITLE,
    excerpt: EXCERPT,
    cover: COVER,
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
  console.log(`H2: ${(body.match(/<h2>/g) || []).length}, H3: ${(body.match(/<h3>/g) || []).length}`);
  console.log(`Figures: ${(body.match(/<figure>/g) || []).length}`);
  console.log(`Renfe links: ${(body.match(/href="https:\/\/www\.renfe\.com/g) || []).length}`);
  console.log(`Touring Spain link: ${body.includes("mybook.to/TouringSpainByTrain")}`);
  console.log(`Collection link: ${body.includes("RealTravelGuidesBooks")}`);
  console.log(`Cover photo in body: ${body.includes("salamanca-view-from-roman-bridge")}`);
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
