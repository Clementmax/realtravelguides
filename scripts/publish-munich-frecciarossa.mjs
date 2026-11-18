/**
 * Publish "Munich to Milan and Rome by Frecciarossa".
 *
 * Resized JPEGs stay in public/images/blog/munich-to-milan-and-rome-by-frecciarossa/.
 * The first photograph is the cover only. The document has no Facebook or
 * Instagram trailer. Body images are registered in lib/body-image-dimensions.json
 * from the saved JPEG pixel size.
 *
 * Usage:
 *   node --use-system-ca scripts/publish-munich-frecciarossa.mjs --dry-run
 *   node --use-system-ca scripts/publish-munich-frecciarossa.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Munich to Milan and Rome by Frecciarossa.docx";

const SLUG = "munich-to-milan-and-rome-by-frecciarossa";
const TITLE =
  "Munich to Milan and Rome by Frecciarossa: Italy's New Direct Alpine Trains for 2027";
const EXCERPT =
  "From summer 2027, Italy's famous Frecciarossa trains are set to connect Munich directly with Milan and Rome, crossing the Alps without a change of train.";
const CATEGORIES = ["italy", "scenicroutes"];
const PLACES = ["munich", "bolzano", "verona", "milan", "bologna", "florence", "rome"];
const NEW_PLACE = "munich";
const PUBLISHED_AT = "2026-11-18";
const IMAGE_DIR = `/images/blog/${SLUG}`;
const FOLDER = path.join("public", "images", "blog", SLUG);
const DIMENSIONS = path.join("lib", "body-image-dimensions.json");
const ITALY_BOOK = "/books#touring-italy-by-train";
const BOOKS_URL = "https://www.realtravelguides.com/books";

const H2 = new Set([
  "Why the New Frecciarossa Services Are Such a Big Deal",
  "Two New Routes Across the Alps",
  "Munich to Milan: The Italian Lakes and Lombardy",
  "Munich to Rome: From the Alps to the Eternal City",
  "The Latest Timetable: What Has Been Announced?",
  "The Scenic Highlight: Crossing the Brenner Pass",
  "What Are Frecciarossa Trains Like?",
  "Can You Break the Journey and Explore Along the Way?",
  "Start in Munich: Bavarian Culture Before the Alps",
  "Where to Stay in Munich",
  "Where to Eat in Munich",
  "Innsbruck: An Alpine Stop Worth Considering",
  "Bolzano: Where Austria Meets Italy",
  "Verona: The Perfect Italian Stopover",
  "Option One: Continue to Milan",
  "Where to Stay in Milan",
  "Where to Eat in Milan",
  "Continue to the Italian Lakes",
  "Option Two: Continue to Florence and Rome",
  "Bologna: Italy's Great Food City",
  "Florence: Renaissance Art and Tuscan Culture",
  "Arriving in Rome: The Eternal City by Rail",
  "Where to Stay in Rome",
  "Where to Eat in Rome",
  "How to Plan a Multi-City Holiday Around the New Frecciarossa",
  "How Much Will the New Frecciarossa Cost?",
  "Practical Tips for Planning Your Journey",
  "When Is the Best Time to Travel?",
  "Why This New Train Matters for the Future of European Travel",
  "Explore More of Europe by Rail",
]);

const H3 = new Set([
  "Standard and Premium",
  "Business Class",
  "Executive Class",
  "Food and Facilities",
  "A Week from Munich to Milan",
  "Ten Days from Munich to Rome",
  "A Longer Alpine and Italian Rail Adventure",
]);

const HANDLES = new Set([
  "@sofitelmunichbayerpost",
  "@dallmayrseit1700",
  "@mo_milan",
  "@rostmilano_",
  "@sixsensesrome",
  "@roscioliroma",
]);

/** Document order. The first image is the cover and is not repeated in the body. */
const PHOTOS = [
  {
    media: "media/image1.jpeg",
    file: "frecciarossa-cable-bridge.jpg",
    cover: true,
    alt: "A red high-speed train crossing a cable-stayed bridge over a wide river",
  },
  {
    media: "media/image2.jpeg",
    file: "frecciarossa-tunnel.jpg",
    cover: false,
    alt: "A red and silver Frecciarossa train beside a tunnel mouth in wooded hills",
  },
  {
    media: "media/image3.jpeg",
    file: "alpine-valley-meadows.jpg",
    cover: false,
    alt: "Green Alpine meadows and forested slopes above a village, with mountains beyond",
  },
  {
    media: "media/image4.jpeg",
    file: "frecciarossa-leather-seats.jpg",
    cover: false,
    alt: "Grey and blue leather Frecciarossa seats with fold-down tables in a carriage",
  },
  {
    media: "media/image5.jpeg",
    file: "frecciarossa-paired-seats.jpg",
    cover: false,
    alt: "Rows of dark Frecciarossa seats in pairs down a carriage under a red screen",
  },
  {
    media: "media/image6.jpeg",
    file: "frecciarossa-executive-seats.jpg",
    cover: false,
    alt: "Cream leather Frecciarossa seats arranged one on each side of a wide aisle",
  },
  {
    media: "media/image7.jpeg",
    file: "munich-marienplatz-sunset.jpg",
    cover: false,
    alt: "Marienplatz in Munich at sunset, with the column and the old town hall",
  },
  {
    media: "media/image8.jpeg",
    file: "innsbruck-river-mountains.jpg",
    cover: false,
    alt: "Innsbruck beside the river, with green domes and snow-covered mountains behind",
  },
  {
    media: "media/image9.jpeg",
    file: "bolzano-cathedral-square.jpg",
    cover: false,
    alt: "Bolzano cathedral and tiled roofs, with mountains rising behind the city",
  },
  {
    media: "media/image10.jpeg",
    file: "verona-river-adige.jpg",
    cover: false,
    alt: "Verona and the River Adige at sunset, with brick towers above the roofs",
  },
  {
    media: "media/image11.jpeg",
    file: "milan-centrale.jpg",
    cover: false,
    alt: "The stone facade of Milano Centrale, with winged horses above the arches",
  },
  {
    media: "media/image12.jpeg",
    file: "bologna-twin-towers.jpg",
    cover: false,
    alt: "Bologna twin brick towers above a street, with a green dome behind them",
  },
  {
    media: "media/image13.jpeg",
    file: "florence-arno-sunset.jpg",
    cover: false,
    alt: "The Florence skyline at sunset, with the Duomo, Ponte Vecchio and the Arno",
  },
  {
    media: "media/image14.jpeg",
    file: "rome-colosseum-sunset.jpg",
    cover: false,
    alt: "The Colosseum and the Roman Forum in Rome beneath an orange evening sky",
  },
  {
    media: "media/image15.jpeg",
    file: "frecciarossa-carriage-logo.jpg",
    cover: false,
    alt: "The red side of a Frecciarossa carriage with the name in large white letters",
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

function isSignOff(text) {
  return text.startsWith("Real Travel Guides");
}

function isSocial(text) {
  const value = text.trim();
  return (
    /^facebook\b/i.test(value) ||
    /^instagram\b/i.test(value) ||
    value.includes("[INSERT") ||
    value.includes("LINK IN BIO") ||
    (value.includes("#") && value.split("#").length > 3 && value.length < 400)
  );
}

function figure(photo) {
  return `<figure><img src="${escapeHtml(publicSrc(photo.file))}" alt="${escapeHtml(photo.alt)}" loading="lazy" decoding="async" /></figure>`;
}

function buildBody(paragraphs) {
  const parts = [];
  const seenHeadings = new Set();
  let photo = 0;
  let socialOmitted = false;
  let sawSignOff = false;

  for (const para of paragraphs) {
    if (para.text && isSocial(para.text)) {
      socialOmitted = true;
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
    if (isSignOff(text)) {
      sawSignOff = true;
      parts.push(`<p><strong>${escapeHtml(text)}</strong></p>`);
      continue;
    }
    if (HANDLES.has(text)) {
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
      const codes = [...text].map((ch) => ch.codePointAt(0).toString(16)).join(" ");
      throw new Error(`Unexpected bold heading: ${JSON.stringify(text)} [${codes}]`);
    }

    let html = paragraphHtml(para.runs);
    if (text.includes("Touring by Train guidebooks covering Italy,")) {
      const needle = "covering Italy,";
      if (!html.includes(needle)) throw new Error("Could not find the Italy guidebook phrase");
      html = html.replace(
        needle,
        `covering <a href="${ITALY_BOOK}">Italy</a>,`
      );
    }
    parts.push(`<p>${html}</p>`);
  }

  if (!sawSignOff) throw new Error("Sign-off was not found");
  if (photo !== PHOTOS.length) throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
  const missing = [...H2, ...H3].filter((heading) => !seenHeadings.has(heading));
  if (missing.length) {
    throw new Error(`Unmatched headings:\n${missing.map((heading) => `  - ${heading}`).join("\n")}`);
  }
  return { body: parts.join("\n"), socialOmitted };
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { minutes: Math.max(1, Math.round(words / 200)), words };
}

function assertBody(body) {
  const leaked = ["LINK IN BIO", "[INSERT", "touring-germany", "touring-austria", "href=\"#\""];
  for (const marker of leaked) {
    if (body.includes(marker)) throw new Error(`Disallowed text in the article: ${marker}`);
  }
  if (/germany|austria/i.test(body) && /\/books#[^"']*(germany|austria)/i.test(body)) {
    throw new Error("A Germany or Austria book URL was added");
  }
  if (body.includes(PHOTOS[0].file)) throw new Error("Cover photograph was repeated in the body");
  const figures = (body.match(/<figure>/g) || []).length;
  const bodyPhotos = PHOTOS.filter((photo) => !photo.cover);
  if (figures !== bodyPhotos.length) throw new Error(`Expected ${bodyPhotos.length} figures, found ${figures}`);
  if ((body.match(/<figcaption>/g) || []).length !== 0) {
    throw new Error("Document has no captions; figcaption should not be invented");
  }
  for (const photo of bodyPhotos) {
    if (!body.includes(`src="${publicSrc(photo.file)}"`)) throw new Error(`Missing body image: ${photo.file}`);
    if (!body.includes('loading="lazy"')) throw new Error("Missing lazy loading");
    const words = wordCount(photo.alt);
    if (words < 8 || words > 18) throw new Error(`Alt text length ${words} for ${photo.file}: ${photo.alt}`);
  }
  const coverWords = wordCount(PHOTOS[0].alt);
  if (coverWords < 8 || coverWords > 18) throw new Error(`Cover alt text length ${coverWords}`);
  for (const href of [
    "https://www.trenitalia.com/",
    "https://www.bahn.de/",
    "https://www.oebb.at/en/",
    BOOKS_URL,
    ITALY_BOOK,
  ]) {
    if (!body.includes(`href="${href}"`)) throw new Error(`Missing link: ${href}`);
  }
  for (const handle of HANDLES) {
    if (!body.includes(handle)) throw new Error(`Missing handle: ${handle}`);
  }
  if (!body.includes("<strong>Real Travel Guides")) throw new Error("Sign-off missing");
}

function assertExcerpt() {
  const length = EXCERPT.length;
  if (length < 140 || length > 160) throw new Error(`Excerpt is ${length} characters`);
  if (!/[.!?]$/.test(EXCERPT)) throw new Error("Excerpt does not end a sentence");
  const last = EXCERPT.slice(0, -1).split(/\s+/).pop();
  if (!last || last.length < 2) throw new Error("Excerpt does not end on a full word");
}

async function writeImages(unzip) {
  mkdirSync(FOLDER, { recursive: true });
  const saved = [];
  for (const photo of PHOTOS) {
    const source = unzip[`word/${photo.media}`];
    if (!source) throw new Error(`Missing document image ${photo.media}`);
    const oriented = await sharp(source, { failOn: "none" }).rotate().metadata();
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
    if (meta.format !== "jpeg") throw new Error(`${photo.file} is not a JPEG`);
    if (!meta.width || !meta.height) throw new Error(`${photo.file} has no pixel size`);
    if (meta.width > oriented.width || meta.height > oriented.height) {
      throw new Error(`${photo.file} was enlarged`);
    }
    if (photo.cover && (meta.width < 200 || meta.height < 200)) {
      throw new Error(`Cover is below Facebook's 200 pixel minimum: ${meta.width}x${meta.height}`);
    }
    if (photo.cover && output.length > aim) {
      throw new Error(`Cover is ${output.length} bytes, above 300 KB`);
    }
    const dest = path.join(FOLDER, photo.file);
    writeFileSync(dest, output);
    const fromDisk = await sharp(dest).metadata();
    const bytes = statSync(dest).size;
    if (fromDisk.width !== meta.width || fromDisk.height !== meta.height || bytes !== output.length) {
      throw new Error(`Saved file metadata does not match the buffer for ${photo.file}`);
    }
    saved.push({
      file: photo.file,
      path: publicSrc(photo.file),
      role: photo.cover ? "cover" : "body",
      bytes,
      width: fromDisk.width,
      height: fromDisk.height,
      quality,
      originalWidth: oriented.width,
      originalHeight: oriented.height,
      over500: bytes > 500 * 1024,
      shortest: Math.min(fromDisk.width, fromDisk.height),
    });
  }
  return saved;
}

function updateDimensions(saved) {
  const bodyImages = saved.filter((image) => image.role === "body");
  let text = readFileSync(DIMENSIONS, "utf8");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const prefix = `${IMAGE_DIR}/`;
  const entryRe = new RegExp(
    `  ${JSON.stringify(prefix).slice(0, -1)}[^"]+": \\{[\\s\\S]*?\\},${nl}`,
    "g"
  );
  text = text.replace(entryRe, "");
  const block = [...bodyImages]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (image) =>
        `  ${JSON.stringify(image.path)}: {${nl}    "width": ${image.width},${nl}    "height": ${image.height}${nl}  },`
    )
    .join(nl);
  const marker = `${nl}  "https://`;
  const at = text.indexOf(marker);
  if (at < 0) throw new Error("Could not find the dimension list insert point");
  text = `${text.slice(0, at)}${nl}${block}${text.slice(at)}`;
  const parsed = JSON.parse(text);
  for (const image of bodyImages) {
    const listed = parsed[image.path];
    if (!listed || listed.width !== image.width || listed.height !== image.height) {
      throw new Error(`Dimension list mismatch for ${image.path}`);
    }
  }
  if (parsed[publicSrc(PHOTOS[0].file)]) {
    throw new Error("Cover was added to the body dimension list");
  }
  writeFileSync(DIMENSIONS, text.endsWith("\n") || text.endsWith("\r\n") ? text : `${text}${nl}`);
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
    const found = paragraphs[0]?.text || "";
    const codes = [...found].map((ch) => ch.codePointAt(0).toString(16)).join(" ");
    throw new Error(`Title mismatch: ${JSON.stringify(found)} [${codes}]`);
  }
  const saved = await writeImages(unzip);
  const { body, socialOmitted } = buildBody(paragraphs);
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
  console.log(`Social promo omitted: ${socialOmitted ? "yes" : "no trailer in the document"}`);
  console.log(`Italy book: ${ITALY_BOOK}`);
  console.log(`Books page: ${BOOKS_URL}`);
  for (const image of saved) {
    console.log(
      `${image.role} ${image.path} ${image.bytes}B ${image.width}x${image.height} q${image.quality} from ${image.originalWidth}x${image.originalHeight} shortest=${image.shortest} over500=${image.over500}`
    );
  }
  updateDimensions(saved);
  console.log("Updated body image dimensions.");

  if (DRY_RUN) {
    writeFileSync(path.join("scripts", "_munich-body-preview.html"), body, "utf8");
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials in .env.local");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: books, error: bookError } = await supabase.from("books").select("slug,title");
  if (bookError) throw bookError;
  const italyBook = (books || []).find((book) => book.slug === "touring-italy-by-train");
  if (!italyBook) throw new Error("Italy book slug touring-italy-by-train is not in the books table");
  console.log(`Book ${italyBook.slug}: ${italyBook.title}`);
  for (const book of books || []) {
    if (/germany|austria/i.test(`${book.slug} ${book.title}`)) {
      console.log(`Leaving unlinked: ${book.slug}`);
    }
  }

  const { data: cats, error: catError } = await supabase.from("categories").select("slug,label");
  if (catError) throw catError;
  for (const slug of CATEGORIES) {
    const row = (cats || []).find((cat) => cat.slug === slug);
    if (!row) throw new Error(`Category slug does not exist: ${slug}`);
    console.log(`Category ${slug}: ${row.label}`);
  }
  if (CATEGORIES.some((slug) => slug === "germany" || slug === "austria")) {
    throw new Error("Germany or Austria category was assigned");
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
    if (place === NEW_PLACE) {
      if (knownPlaces.has(place)) console.log(`Place ${place} already exists`);
      else console.log(`Place ${place} is a new city tag`);
      continue;
    }
    if (!knownPlaces.has(place)) throw new Error(`Place tag is not already in use: ${place}`);
  }
  if (PLACES.includes("germany") || PLACES.includes("austria") || PLACES.includes("innsbruck")) {
    throw new Error("Disallowed place tag");
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
