/**
 * Publish "Paris to Turin by Train: Take the Long Way Through Chambéry".
 *
 * Images stay in public/images/blog/paris-to-turin-via-chambery/
 * Cover is the 1200×630 social crop, not repeated in the body.
 *
 * Usage:
 *   node --use-system-ca scripts/publish-paris-turin.mjs --dry-run
 *   node --use-system-ca scripts/publish-paris-turin.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Paris to Turin by Train.docx";

const SLUG = "paris-to-turin-by-train";
const TITLE = "Paris to Turin by Train: Take the Long Way Through Chambéry";
const EXCERPT =
  "A flight-free rail journey from Paris to Turin via Chambéry, with a night in the old capital of Savoy and a train through the Alps into Piedmont.";
const CATEGORIES = ["france", "italy", "scenicroutes"];
const PUBLISHED_AT = "2026-10-03";
const IMAGE_DIR = "/images/blog/paris-to-turin-via-chambery";
const FOLDER = path.join("public", "images", "blog", "paris-to-turin-via-chambery");
const COVER_FILE = "turin-at-sunset-social.jpg";

const H2 = new Set([
  "The Journey at a Glance",
  "Day 1: Paris to Chambéry",
  "Why Stop in Chambéry?",
  "Where to Eat in Chambéry",
  "Where to Stay in Chambéry",
  "Day 2: Don\u2019t Rush to Turin",
  "Chambéry to Turin: The Journey Through the Mountains",
  "Where to Stay in Turin",
  "Your First Evening: Learn the Art of Aperitivo",
  "Day 3: Begin with Royal Turin",
  "What to Eat in Turin",
  "Day 4: One Last Morning in Turin",
  "Starting in London?",
  "Not Ready to Stop? Continue to Rome",
  "Booking the Journey",
  "Why Take the Long Way?",
  "Explore France and Italy by Train",
]);

const H3 = new Set([
  "Day 1: Paris \u2192 Chambéry",
  "Day 2: Chambéry \u2192 Turin",
  "Day 3: Turin",
  "Day 4: Turin",
  "Begin with the Elephants",
  "Find Chambéry\u2019s Hidden Passages",
  "Château des Ducs de Savoie",
  "Before Turin, the Shroud Was Here",
  "Rousseau at Les Charmettes",
  "Arriving in Turin",
  "The Shroud\u2019s Journey Ends Here",
  "Coffee in a Historic Café",
  "Choose Your Museum",
  "Walk Beneath Turin\u2019s Arcades",
  "Finish Above the River Po",
]);

/** Doc image order. The first photograph is the hero and is not repeated in the body. */
const PHOTOS = [
  {
    file: "turin-at-sunset.jpg",
    alt: "Turin at sunset, with the Mole Antonelliana and the Alps beyond the rooftops",
  },
  {
    file: "Fontaine-des-Éléphants-chambery .jpg",
    alt: "One of the elephants of the Fontaine des Éléphants in Chambéry",
  },
  {
    file: "chambery-statue.jpg",
    alt: "A fountain with bronze figures in a square of shuttered buildings in Chambéry",
  },
  {
    file: "Château-des-Ducs-de-Savoie-chambery .jpg",
    alt: "The stone walls and towers of the Château des Ducs de Savoie above a square in Chambéry",
  },
  {
    file: "chambery-historic-church.jpg",
    alt: "Sunlight falling through the vaulted interior of a historic church in Chambéry",
  },
  {
    file: "turin-evening-quadrilatero.jpg",
    alt: "Evening tables outside a trattoria on a narrow street in Turin",
  },
  {
    file: "piazza-castello-turin.jpg",
    alt: "Palazzo Madama in Piazza Castello, Turin, seen from above",
  },
  {
    file: "bicerin-coffee-turin.jpg",
    alt: "The shopfront of Caffè Al Bicerin in Turin",
  },
  {
    file: "gallery-turin.jpg",
    alt: "Café tables beneath the glass roof of a gallery in central Turin",
  },
  {
    file: "turin-aerial-view.jpg",
    alt: "The River Po and the dome of the Gran Madre di Dio in Turin",
  },
];

const HANDLES = [
  "@cafedelyonchambery",
  "@la.maniguette.epicurieux",
  "@phc_chambery",
  "@thisiscombo",
  "@opera35_torino",
  "@caffemulassano",
  "@pastificiodefilippis",
  "@scannabuecaffe",
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
  if (!url.searchParams.has("utm_source")) return href;
  url.searchParams.delete("utm_source");
  if ([...url.searchParams.keys()].length === 0) url.search = "";
  return url.toString();
}

function link(href, text) {
  return `<a href="${escapeHtml(cleanUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function figure(photo) {
  return `<figure><img src="${escapeHtml(publicSrc(photo.file))}" alt="${escapeHtml(photo.alt)}" loading="lazy" decoding="async" /></figure>`;
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
    const text = runs.map((run) => run.text).join("").trim();
    if (!text && !images.length) continue;
    paragraphs.push({ runs, text, images });
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
  return segments
    .map((seg) => {
      if (seg.href) return link(seg.href, seg.text.trim());
      const text = escapeHtml(seg.text).replace(/\n/g, "<br>");
      if (!seg.bold || !seg.text.trim()) return text;
      const lead = text.match(/^\s*/)[0];
      const tail = text.match(/\s*$/)[0];
      return `${lead}<strong>${text.trim()}</strong>${tail}`;
    })
    .join("")
    .trim();
}

function operatorName(href) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  if (host === "sncf-connect.com") return "SNCF Connect";
  if (host === "eurostar.com") return "Eurostar";
  if (host === "trenitalia.com") return "Trenitalia";
  return null;
}

function linkPhrase(html, phrase, href) {
  const strong = `<strong>${escapeHtml(phrase)}</strong>`;
  const anchored = `<a href="${escapeHtml(cleanUrl(href))}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(phrase)}</strong></a>`;
  if (html.includes(strong)) return html.replace(strong, anchored);
  const plain = escapeHtml(phrase);
  if (!html.includes(plain)) throw new Error(`Could not link phrase: ${phrase}`);
  return html.replace(plain, link(href, phrase));
}

function attachOperatorLink(html, href) {
  const name = operatorName(href);
  if (!name) throw new Error(`No operator label for ${href}`);
  const strong = `<strong>${escapeHtml(name)}</strong>`;
  const plain = escapeHtml(name);
  if (!html.includes(strong) && !html.includes(plain)) {
    throw new Error(`Operator name not in previous paragraph: ${name}`);
  }
  if (html.includes(`>${escapeHtml(name)}</a>`)) {
    throw new Error(`Operator already linked: ${name}`);
  }
  return linkPhrase(html, name, href);
}

const BOOK_LINKS = [
  { phrase: "Touring France by Train", href: "https://mybook.to/TouringFranceByTrain" },
  { phrase: "Touring Italy by Train", href: "https://mybook.to/TouringItalybyTrain" },
];

function buildBody(paragraphs) {
  const parts = [];
  const seenHeadings = new Set();
  let photo = 0;

  const lastParagraph = () => {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i].startsWith("<p>")) return i;
    }
    return -1;
  };

  for (const para of paragraphs) {
    if (para.images.length) {
      for (const _image of para.images) {
        const image = PHOTOS[photo];
        photo += 1;
        if (!image) throw new Error("More images in the document than supplied photographs");
        if (photo === 1) continue;
        parts.push(figure(image));
      }
      if (para.text) throw new Error(`Image paragraph also has text: ${para.text.slice(0, 80)}`);
      continue;
    }

    const { text } = para;
    if (!text || text === TITLE) continue;

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

    if (/^https?:\/\//i.test(text)) {
      const href = cleanUrl(para.runs.find((run) => run.href)?.href || text);
      const prev = lastParagraph();
      if (prev === -1) throw new Error(`URL with no previous paragraph: ${href}`);
      const book = BOOK_LINKS.find((item) => href.includes(new URL(item.href).pathname.replace(/^\//, "")) || href.startsWith(item.href));
      if (book) {
        const titleOnly = parts[prev] === `<p>${escapeHtml(book.phrase)}</p>` || parts[prev] === `<p><strong>${escapeHtml(book.phrase)}</strong></p>`;
        if (!titleOnly) throw new Error(`Book URL did not follow its title: ${book.phrase}`);
        parts[prev] = `<p>${link(book.href, book.phrase)}</p>`;
        continue;
      }
      parts[prev] = attachOperatorLink(parts[prev], href);
      continue;
    }

    let html = paragraphHtml(para.runs);
    if (text.includes("Our Touring France by Train and Touring Italy by Train guides")) {
      for (const book of BOOK_LINKS) html = linkPhrase(html, book.phrase, book.href);
    }
    parts.push(`<p>${html}</p>`);
  }

  if (photo !== PHOTOS.length) {
    throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
  }
  const missing = [...H2, ...H3].filter((heading) => !seenHeadings.has(heading));
  if (missing.length) {
    throw new Error(`Unmatched headings:\n${missing.map((heading) => `  - ${heading}`).join("\n")}`);
  }
  return parts.join("\n");
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { minutes: Math.max(1, Math.round(words / 200)), words };
}

function assertImagesExist() {
  const files = [...PHOTOS.map((photo) => photo.file), COVER_FILE];
  const missing = files.filter((file) => !existsSync(path.join(FOLDER, file)));
  if (missing.length) {
    throw new Error(`Missing image files:\n${missing.map((file) => `  - ${file}`).join("\n")}`);
  }
}

function assertBody(body) {
  const visible = body.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ").replace(/<[^>]+>/g, " ");
  if (/https?:\/\//i.test(visible)) throw new Error("Bare URL left in visible text");
  if (body.includes("utm_source")) throw new Error("utm_source left in body");
  if (body.includes("turin-at-sunset.jpg")) throw new Error("Hero sunset photo was repeated in the body");
  if (!body.includes("turin-at-sunset-social.jpg") && body.includes(COVER_FILE)) {
    throw new Error("Social cover was placed in the body");
  }
  const figures = (body.match(/<figure>/g) || []).length;
  if (figures !== PHOTOS.length - 1) throw new Error(`Expected ${PHOTOS.length - 1} figures, found ${figures}`);
  for (const handle of HANDLES) {
    if (!body.includes(handle)) throw new Error(`Missing handle: ${handle}`);
  }
  if ((body.match(/instagram\.com/g) || []).length) throw new Error("Invented or unexpected Instagram URL");
  const sncf = (body.match(/sncf-connect\.com/g) || []).length;
  const eurostar = (body.match(/eurostar\.com/g) || []).length;
  const trenitalia = (body.match(/trenitalia\.com/g) || []).length;
  const france = (body.match(/TouringFranceByTrain/g) || []).length;
  const italy = (body.match(/TouringItalybyTrain/g) || []).length;
  if (sncf !== 3) throw new Error(`Expected 3 SNCF links, found ${sncf}`);
  if (eurostar !== 2) throw new Error(`Expected 2 Eurostar links, found ${eurostar}`);
  if (trenitalia !== 2) throw new Error(`Expected 2 Trenitalia links, found ${trenitalia}`);
  if (france !== 2) throw new Error(`Expected 2 France book links, found ${france}`);
  if (italy !== 2) throw new Error(`Expected 2 Italy book links, found ${italy}`);
  const h2 = (body.match(/<h2>/g) || []).length;
  const h3 = (body.match(/<h3>/g) || []).length;
  if (h2 !== H2.size || h3 !== H3.size) throw new Error(`Heading count h2 ${h2}/${H2.size} h3 ${h3}/${H3.size}`);
}

async function assertDatabaseReady(supabase) {
  const { data: cats, error: catError } = await supabase.from("categories").select("slug,label");
  if (catError) throw catError;
  for (const slug of CATEGORIES) {
    const row = (cats || []).find((cat) => cat.slug === slug);
    if (!row) throw new Error(`Category slug does not exist: ${slug}`);
    console.log(`Category ${slug}: ${row.label}`);
  }
  for (const slug of [SLUG, "paris-to-turin-via-chambery"]) {
    const { data: existing, error } = await supabase.from("posts").select("slug").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (existing) throw new Error(`Post already exists: ${slug}`);
    console.log(`Slug free: ${slug}`);
  }
  const { data: latest, error: latestError } = await supabase
    .from("posts")
    .select("slug,published_at")
    .order("published_at", { ascending: false })
    .limit(5);
  if (latestError) throw latestError;
  console.log("Latest posts:");
  for (const row of latest || []) console.log(`  ${row.published_at} ${row.slug}`);
  const newer = (latest || []).filter((row) => String(row.published_at) >= PUBLISHED_AT);
  if (newer.length) {
    throw new Error(`A post is already dated ${PUBLISHED_AT} or later: ${newer.map((row) => row.slug).join(", ")}`);
  }
}

async function main() {
  assertImagesExist();
  const body = buildBody(readDocxParagraphs(DOC));
  assertBody(body);
  const { minutes, words } = estimateReadMinutes(body);
  const record = {
    slug: SLUG,
    title: TITLE,
    excerpt: EXCERPT,
    cover: publicSrc(COVER_FILE),
    categories: CATEGORIES,
    read_minutes: minutes,
    published_at: PUBLISHED_AT,
    body,
    images: null,
  };

  console.log(`Title: ${record.title}`);
  console.log(`Slug: ${record.slug}`);
  console.log(`Cover: ${record.cover}`);
  console.log(`Categories: ${record.categories.join(", ")}`);
  console.log(`Words: ${words}`);
  console.log(`Read minutes: ${record.read_minutes}`);
  console.log(`H2: ${(body.match(/<h2>/g) || []).length}, H3: ${(body.match(/<h3>/g) || []).length}`);
  console.log(`Figures: ${(body.match(/<figure>/g) || []).length}`);
  console.log(`Body chars: ${body.length}`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await assertDatabaseReady(supabase);

  if (DRY_RUN) {
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  const { error } = await supabase.from("posts").insert(record);
  if (error) throw error;

  const { data: row, error: readError } = await supabase
    .from("posts")
    .select("slug,title,categories,published_at,cover,images,excerpt,body")
    .eq("slug", SLUG)
    .single();
  if (readError) throw readError;
  const stored = row.body || "";
  console.log("\nVerified row:");
  console.log(`slug: ${row.slug}`);
  console.log(`title: ${row.title}`);
  console.log(`categories: ${(row.categories || []).join(", ")}`);
  console.log(`published_at: ${row.published_at}`);
  console.log(`cover: ${row.cover}`);
  console.log(`images: ${JSON.stringify(row.images)}`);
  console.log(`excerpt: ${row.excerpt}`);
  console.log(`figures: ${(stored.match(/<figure>/g) || []).length}`);
  console.log(`france book: ${(stored.match(/TouringFranceByTrain/g) || []).length}`);
  console.log(`italy book: ${(stored.match(/TouringItalybyTrain/g) || []).length}`);
  console.log(`sncf: ${(stored.match(/sncf-connect\.com/g) || []).length}`);
  console.log(`eurostar: ${(stored.match(/eurostar\.com/g) || []).length}`);
  console.log(`trenitalia: ${(stored.match(/trenitalia\.com/g) || []).length}`);
  console.log(`\nPublished /post/${SLUG}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
