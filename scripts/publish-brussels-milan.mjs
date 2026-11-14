/**
 * Publish "Brussels to Milan by Night Train".
 *
 * Resized JPEGs stay in public/images/blog/brussels-to-milan-by-night-train/.
 * The first photograph (Milan) is the cover only, matching recent posts.
 * Facebook and Instagram copy at the end of the Word document is omitted.
 *
 * Usage:
 *   node --use-system-ca scripts/publish-brussels-milan.mjs --dry-run
 *   node --use-system-ca scripts/publish-brussels-milan.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Brussels to Milan by Night Train.docx";

const SLUG = "brussels-to-milan-by-night-train";
const TITLE =
  "Brussels to Milan by Night Train: Europe's New Sleeper Journey Through the Swiss Alps";
const EXCERPT =
  "The new overnight train from Brussels to Milan crosses the Swiss Alps by morning and arrives in the heart of northern Italy in time for lunch.";
const CATEGORIES = ["switzerland", "italy", "scenicroutes"];
const PLACES = ["gotthard", "bellinzona", "lugano", "ticino", "como", "lake-como", "milan"];
const PUBLISHED_AT = "2026-11-14";
const IMAGE_DIR = "/images/blog/brussels-to-milan-by-night-train";
const FOLDER = path.join("public", "images", "blog", SLUG);
const CREDIT =
  "Photographs taken inside the train, and of the sleeper, courtesy of European Sleeper.";
const SIGN_OFF = "Real Travel Guides — Real Travel. By Rail.";

const H2 = new Set([
  "Why This New Night Train Matters",
  "The Route: Five Countries in One Journey",
  "New for December 2026: More Ways to Reach Italy by Sleeper",
  "Boarding in Brussels: A City Worth Exploring",
  "Where to Eat in Brussels",
  "Where to Stay in Brussels",
  "Choosing Your Sleeper Accommodation",
  "What Does the Night Train Cost?",
  "A Night on Board",
  "Waking Up in Switzerland: The Historic Gotthard Railway",
  "Bellinzona: Medieval Castles and a Taste of Ticino",
  "Where to Eat in Bellinzona",
  "Lugano: Palm Trees Beneath the Alps",
  "Where to Eat in Lugano",
  "Lake Como: An Italian Escape Without the Airport",
  "Arriving in Milan: A Different Side of the City",
  "Where to Eat in Milan",
  "Where to Stay in Milan",
  "How to Turn the Journey into a Longer European Holiday",
  "Practical Tips for Booking the Brussels–Milan Sleeper",
  "When Is the Best Time to Travel?",
  "Is the Brussels–Milan Night Train Worth Taking?",
  "Explore More of Europe by Rail",
]);

const H3 = new Set([
  "Budget Class",
  "Classic Couchette",
  "Comfort Standard",
  "Comfort Plus",
  "Brussels, Lake Como and Milan",
  "Brussels, Ticino and the Italian Lakes",
  "London to Italy Without Flying",
]);

/** Document order. The first image is the Milan cover and is not repeated in the body. */
const PHOTOS = [
  {
    media: "media/image1.jpeg",
    file: "milan-duomo-galleria.jpg",
    cover: true,
    interior: false,
    alt: "The Milan Duomo and Galleria Vittorio Emanuele II across the square at dusk",
  },
  {
    media: "media/image2.jpg",
    file: "european-sleeper-carriage.jpg",
    cover: false,
    interior: true,
    alt: "A burgundy European Sleeper carriage beside the platform in a station hall",
  },
  {
    media: "media/image3.jpeg",
    file: "sleeper-corridor-sunset.jpg",
    cover: false,
    interior: true,
    alt: "Sunset over the fields, seen from the corridor of a sleeper train",
  },
  {
    media: "media/image4.jpeg",
    file: "brussels-grand-place.jpg",
    cover: false,
    interior: false,
    alt: "Ornate guild houses with gilded stonework on the Grand-Place in Brussels",
  },
  {
    media: "media/image5.jpeg",
    file: "galeries-royales-saint-hubert.jpg",
    cover: false,
    interior: false,
    alt: "Shoppers under the glass roof of the Galeries Royales Saint-Hubert in Brussels",
  },
  {
    media: "media/image6.jpeg",
    file: "sleeper-couchette.jpg",
    cover: false,
    interior: true,
    alt: "Blue couchette berths in a sleeper compartment, with bedding folded for the night",
  },
  {
    media: "media/image7.jpeg",
    file: "sleeper-berth-table.jpg",
    cover: false,
    interior: true,
    alt: "A fold-down table in a sleeper berth, set with wine and a drink",
  },
  {
    media: "media/image8.jpeg",
    file: "sleeper-washbasin.jpg",
    cover: false,
    interior: true,
    alt: "A fold-out washbasin and mirror inside a European Sleeper compartment",
  },
  {
    media: "media/image9.jpeg",
    file: "gotthard-tunnel-portal.jpg",
    cover: false,
    interior: false,
    alt: "The twin stone portals of the Gotthard railway tunnel, dated 1882",
  },
  {
    media: "media/image10.jpeg",
    file: "bellinzona-castelgrande.jpg",
    cover: false,
    interior: false,
    alt: "Bellinzona and the surrounding Alps, seen from the ramparts of Castelgrande",
  },
  {
    media: "media/image11.jpeg",
    file: "lugano-monte-san-salvatore.jpg",
    cover: false,
    interior: false,
    alt: "Monte San Salvatore above Lugano and the lake in the evening light",
  },
  {
    media: "media/image12.jpeg",
    file: "brunate-funicular-como.jpg",
    cover: false,
    interior: false,
    alt: "The red Brunate funicular climbing above Como, with Lake Como beyond",
  },
  {
    media: "media/image13.jpeg",
    file: "como-waterfront.jpg",
    cover: false,
    interior: false,
    alt: "Como’s cathedral and lakeside promenade seen across the water at dusk",
  },
  {
    media: "media/image14.jpeg",
    file: "milan-galleria.jpg",
    cover: false,
    interior: false,
    alt: "The Galleria Vittorio Emanuele II in Milan, opening onto the street at dusk",
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
  return `${IMAGE_DIR}/${file}`;
}

function wordCount(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
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
    const text = [...run.replace(/<w:br\b[^>]*\/?>/g, "<w:t>\n</w:t>").matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((part) => decodeXml(part[1]))
      .join("");
    return { bold, href, text };
  });
}

function readDocx(docxPath) {
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
    const images = [...block.matchAll(/r:embed="([^"]+)"/g)].map((match) => relMap[match[1]] || match[1]);
    const runs = [];
    const pattern = /<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g;
    let last = 0;
    for (const match of block.matchAll(pattern)) {
      runs.push(...runsOf(block.slice(last, match.index)));
      runs.push(...runsOf(match[2], relMap[match[1]] || match[1]));
      last = match.index + match[0].length;
    }
    runs.push(...runsOf(block.slice(last)));
    const text = runs.map((run) => run.text).join("").replace(/\s+/g, " ").trim();
    if (!text && !images.length) continue;
    paragraphs.push({ runs, text, images });
  }
  return { paragraphs, unzip };
}

function paragraphHtml(runs) {
  const segments = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = segments[segments.length - 1];
    if (prev && prev.bold === run.bold && prev.href === run.href) prev.text += run.text;
    else segments.push({ ...run });
  }
  return segments
    .map((seg) => {
      if (seg.href) {
        const href = escapeHtml(seg.href);
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(seg.text.trim())}</a>`;
      }
      const text = escapeHtml(seg.text).replace(/\n/g, "<br>");
      if (!seg.bold || !seg.text.trim()) return text;
      const lead = text.match(/^\s*/)[0];
      const tail = text.match(/\s*$/)[0];
      return `${lead}<strong>${text.trim()}</strong>${tail}`;
    })
    .join("")
    .trim();
}

function isFullyBold(runs) {
  const textual = runs.filter((run) => run.text.trim());
  return textual.length > 0 && textual.every((run) => run.bold);
}

function isSocial(text) {
  return (
    text.startsWith("NEW FOR 2026") ||
    text.startsWith("NEW NIGHT TRAIN ALERT") ||
    text.includes("[INSERT ARTICLE URL]") ||
    text.includes("LINK IN BIO") ||
    text.includes("#NightTrain") ||
    text.includes("#EuropeanSleeper")
  );
}

function figure(photo) {
  return `<figure><img src="${escapeHtml(publicSrc(photo.file))}" alt="${escapeHtml(photo.alt)}" loading="lazy" decoding="async" /></figure>`;
}

function buildBody(paragraphs) {
  const parts = [];
  const seenHeadings = new Set();
  let photo = 0;
  let stopped = false;

  for (const para of paragraphs) {
    if (para.text && isSocial(para.text)) {
      stopped = true;
      break;
    }

    if (para.images.length) {
      for (const target of para.images) {
        const image = PHOTOS[photo];
        photo += 1;
        if (!image) throw new Error("More images in the document than expected");
        if (target !== image.media) throw new Error(`Image order mismatch: expected ${image.media}, found ${target}`);
        if (image.cover) continue;
        parts.push(figure(image));
      }
      if (para.text) throw new Error(`Image paragraph also has text: ${para.text.slice(0, 80)}`);
      continue;
    }

    const { text } = para;
    if (!text || text === TITLE) continue;
    if (text === SIGN_OFF) {
      parts.push(`<p><strong>${escapeHtml(text)}</strong></p>`);
      continue;
    }
    if (H2.has(text)) {
      seenHeadings.add(text);
      parts.push(`<h2>${escapeHtml(text)}</h2>`);
      continue;
    }
    if (H3.has(text)) {
      seenHeadings.add(text);
      parts.push(`<h3>${escapeHtml(text)}</h3>`);
      continue;
    }
    if (isFullyBold(para.runs)) {
      throw new Error(`Unexpected bold heading: ${text}`);
    }
    parts.push(`<p>${paragraphHtml(para.runs)}</p>`);
  }

  if (!stopped) throw new Error("Did not find the social copy that ends the document");
  if (photo !== PHOTOS.length) throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
  const missing = [...H2, ...H3].filter((heading) => !seenHeadings.has(heading));
  if (missing.length) {
    throw new Error(`Unmatched headings:\n${missing.map((heading) => `  - ${heading}`).join("\n")}`);
  }
  parts.push(`<p>${escapeHtml(CREDIT)}</p>`);
  return parts.join("\n");
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { minutes: Math.max(1, Math.round(words / 200)), words };
}

function assertBody(body) {
  const leaked = [
    "NEW FOR 2026",
    "NEW NIGHT TRAIN ALERT",
    "[INSERT ARTICLE URL]",
    "LINK IN BIO",
    "#NightTrain",
    "#EuropeanSleeper",
    "WHY WE LOVE THIS JOURNEY",
    "READ THE FULL STORY",
  ];
  for (const marker of leaked) {
    if (body.includes(marker)) throw new Error(`Social copy leaked into the article: ${marker}`);
  }
  if (body.includes(PHOTOS[0].file)) throw new Error("Cover photograph was repeated in the body");
  const figures = (body.match(/<figure>/g) || []).length;
  if (figures !== PHOTOS.length - 1) throw new Error(`Expected ${PHOTOS.length - 1} figures, found ${figures}`);
  if (!body.endsWith(`<p>${escapeHtml(CREDIT)}</p>`)) throw new Error("Accreditation is not the final paragraph");
  if ((body.match(/courtesy of European Sleeper/g) || []).length !== 1) {
    throw new Error("Accreditation sentence should appear once");
  }
  for (const photo of PHOTOS) {
    if (photo.cover) continue;
    if (!body.includes(photo.file)) throw new Error(`Missing body image: ${photo.file}`);
    const words = wordCount(photo.alt);
    if (words < 8 || words > 18) throw new Error(`Alt text length ${words} for ${photo.file}`);
  }
  if ((body.match(/europeansleeper\.eu/g) || []).length < 2) throw new Error("Missing European Sleeper links");
  if (!body.includes("https://www.realtravelguides.com/books")) throw new Error("Missing books link from the document");
  if (!body.includes("@labuvettebruxelles") || !body.includes("@palazzoparigi")) {
    throw new Error("Restaurant or hotel handles were dropped");
  }
}

async function writeImages(unzip) {
  mkdirSync(FOLDER, { recursive: true });
  const saved = [];
  for (const photo of PHOTOS) {
    const source = unzip[`word/${photo.media}`];
    if (!source) throw new Error(`Missing document image ${photo.media}`);
    const maxWidth = photo.cover ? 1200 : 1600;
    const aim = 300 * 1000;
    let quality = 80;
    let output;
    let meta;
    while (quality >= 60) {
      output = await sharp(source, { failOn: "none" })
        .rotate()
        .resize({ width: maxWidth, withoutEnlargement: true, fit: "inside" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      meta = await sharp(output).metadata();
      if (output.length <= aim || quality <= 65) break;
      quality -= 5;
    }
    if (output.length > 500 * 1024 && quality > 60) {
      quality = 60;
      output = await sharp(source, { failOn: "none" })
        .rotate()
        .resize({ width: maxWidth, withoutEnlargement: true, fit: "inside" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      meta = await sharp(output).metadata();
    }
    const dest = path.join(FOLDER, photo.file);
    writeFileSync(dest, output);
    const original = await sharp(source, { failOn: "none" }).rotate().metadata();
    saved.push({
      file: photo.file,
      path: publicSrc(photo.file),
      role: photo.cover ? "cover" : "body",
      interior: photo.interior,
      bytes: output.length,
      width: meta.width,
      height: meta.height,
      quality,
      originalWidth: original.width,
      originalHeight: original.height,
      over500: output.length > 500 * 1024,
    });
  }
  return saved;
}

function assertExcerpt() {
  const length = EXCERPT.length;
  if (length < 140 || length > 160) throw new Error(`Excerpt is ${length} characters`);
  if (!/[.!?]$/.test(EXCERPT)) throw new Error("Excerpt does not end a sentence");
  if (/\b(click|follow|link in bio|don't miss)\b/i.test(EXCERPT)) {
    throw new Error("Excerpt sounds like social promo");
  }
}

function safeError(err) {
  const message = err?.message || String(err);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return key ? message.split(key).join("[redacted]") : message;
}

async function main() {
  assertExcerpt();
  const { paragraphs, unzip } = readDocx(DOC);
  if (paragraphs[0]?.text !== TITLE) {
    throw new Error(`Title mismatch: ${JSON.stringify(paragraphs[0]?.text)}`);
  }
  const saved = await writeImages(unzip);
  const body = buildBody(paragraphs);
  assertBody(body);
  const { minutes, words } = estimateReadMinutes(body);
  const record = {
    slug: SLUG,
    title: TITLE,
    excerpt: EXCERPT,
    cover: publicSrc(PHOTOS[0].file),
    categories: CATEGORIES,
    places: PLACES,
    read_minutes: minutes,
    published_at: PUBLISHED_AT,
    body,
    images: null,
  };

  console.log(`Title: ${record.title}`);
  console.log(`Slug: ${record.slug}`);
  console.log(`Excerpt (${EXCERPT.length}): ${record.excerpt}`);
  console.log(`Categories: ${record.categories.join(", ")}`);
  console.log(`Places: ${record.places.join(", ")}`);
  console.log(`Published: ${record.published_at}`);
  console.log(`Words: ${words}`);
  console.log(`Read minutes: ${record.read_minutes}`);
  console.log(`Cover: ${record.cover}`);
  console.log(`Figures: ${(body.match(/<figure>/g) || []).length}`);
  console.log(`Credit: ${CREDIT}`);
  for (const image of saved) {
    console.log(
      `${image.role} ${image.path} ${image.bytes}B ${image.width}x${image.height} q${image.quality} from ${image.originalWidth}x${image.originalHeight} interior=${image.interior} over500=${image.over500}`
    );
  }

  if (DRY_RUN) {
    writeFileSync(path.join("scripts", "_brussels-body-preview.html"), body, "utf8");
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials in .env.local");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: cats, error: catError } = await supabase.from("categories").select("slug,label");
  if (catError) throw catError;
  for (const slug of CATEGORIES) {
    const row = (cats || []).find((cat) => cat.slug === slug);
    if (!row) throw new Error(`Category slug does not exist: ${slug}`);
    console.log(`Category ${slug}: ${row.label}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("posts")
    .select("slug")
    .eq("slug", SLUG)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error(`Post already exists: ${SLUG}`);

  const { data: placeRows, error: placeError } = await supabase.from("posts").select("places");
  if (placeError) throw placeError;
  const knownPlaces = new Set();
  for (const row of placeRows || []) {
    for (const place of row.places || []) knownPlaces.add(place);
  }
  for (const place of PLACES) {
    if (!knownPlaces.has(place)) throw new Error(`Place tag is not already in use: ${place}`);
  }
  if (knownPlaces.has("brussels") || knownPlaces.has("bruxelles")) {
    throw new Error("A Brussels place tag exists; review before omitting it");
  }

  const { error } = await supabase.from("posts").insert(record);
  if (error) throw error;

  const { data: row, error: readError } = await supabase
    .from("posts")
    .select("slug,title,categories,places,published_at,cover,images,excerpt,read_minutes")
    .eq("slug", SLUG)
    .single();
  if (readError) throw readError;
  console.log("\nInserted row:");
  console.log(`slug: ${row.slug}`);
  console.log(`title: ${row.title}`);
  console.log(`categories: ${(row.categories || []).join(", ")}`);
  console.log(`places: ${(row.places || []).join(", ")}`);
  console.log(`published_at: ${row.published_at}`);
  console.log(`cover: ${row.cover}`);
  console.log(`images: ${JSON.stringify(row.images)}`);
  console.log(`excerpt: ${row.excerpt}`);
  console.log(`read_minutes: ${row.read_minutes}`);
}

main().catch((err) => {
  console.error("FAILED:", safeError(err));
  process.exit(1);
});
