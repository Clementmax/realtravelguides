/**
 * Publish "Spoleto by Train: Umbria's Spectacular Hill Town, Just a Day Trip from Rome".
 *
 * Images stay in public/images/blog/spoleto-day-trip-by-train/
 * Cover is the 1200×630 social crop of the first photograph, not repeated in the body.
 *
 * Usage:
 *   node --use-system-ca scripts/publish-spoleto.mjs --dry-run
 *   node --use-system-ca scripts/publish-spoleto.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Spoleto by Train.docx";

const SLUG = "spoleto-by-train";
const TITLE = "Spoleto by Train: Umbria's Spectacular Hill Town, Just a Day Trip from Rome";
const EXCERPT =
  "There are Italian hill towns that are beautiful from a distance, and then there is Spoleto \u2014 a town that seems to reveal something extraordinary around almost every corner. You can reach Spoleto by direct train from Rome in around 1 hour 20 minutes on the faster services, making it an excellent day trip without a car.";
const CATEGORIES = ["italy", "culture"];
const PUBLISHED_AT = "2026-10-20";
const IMAGE_DIR = "/images/blog/spoleto-day-trip-by-train";
const FOLDER = path.join("public", "images", "blog", "spoleto-day-trip-by-train");
const HERO_FILE = "Spoleto View of Castello and Bridge.jpg";
const COVER_FILE = "Spoleto View of Castello and Bridge-social.jpg";
const HERO_BYTES = 206860;
const BOOK_HREF = "https://mybook.to/TouringItalybyTrain";
const COLLECTION_HREF = "https://mybook.to/RealTravelGuidesBooks";
const BOOK_PHRASE = "Touring Italy by Train";
const CULTURA_HREF = "https://www.spoletocultura.it";
const FESTIVAL_HREF = "https://www.festivaldispoleto.com";
const TRENITALIA_HREF = "https://www.trenitalia.com";

const H2 = new Set([
  "Begin in Piazza del Mercato: Spoleto's Ancient Heart",
  "Piazza del Duomo: One of Italy's Most Beautiful Cathedral Squares",
  "Climb to the Rocca Albornoziana: Fortress of Popes and Dukes",
  "The Ponte delle Torri: Spoleto's Most Extraordinary Landmark",
  "Roman Spoleto: A Theatre, an Ancient House and a Hidden Arch",
  "Another Hidden Gem: San Salvatore, a UNESCO Treasure",
  "Where to Eat in Spoleto",
  "Where to Stay in Spoleto",
  "Festival dei Due Mondi: When Spoleto Becomes an International Stage",
  "How to Get to Spoleto by Train",
  "A Whole String of Umbrian Towns by Train",
  "When Is the Best Time to Visit Spoleto?",
  "Why Spoleto Deserves a Place on Your Italian Itinerary",
  "Explore More of Italy by Train",
]);

const H3 = new Set([
  "Filippo Lippi's Last Masterpiece",
  "Hidden Gem: Walk Into the Woods of Monteluco",
  "From Rome",
  "From Perugia",
  "From Florence",
  "Arriving at Spoleto Station",
]);

const KEEP_BOLD = new Set([BOOK_PHRASE]);

/** Document order. The first photograph is the hero and is not repeated in the body. */
const PHOTOS = [
  {
    file: HERO_FILE,
    alt: "The Rocca Albornoziana and the Ponte delle Torri above a wooded gorge in Spoleto, framed by trees",
  },
  {
    file: "spoleto cathedral early morning .jpg",
    alt: "Spoleto Cathedral at the foot of a broad staircase, with its bell tower, rose window and mosaic",
  },
  {
    file: "Filippo Lippi Alter Painting Spoleto Cathedral.jpg",
    alt: "Filippo Lippi's Coronation of the Virgin in Spoleto Cathedral, crowded with angels and saints",
  },
  {
    file: "Duomo of Spoleto.jpg",
    alt: "Weathered frescoes inside Spoleto Cathedral, with roundels of the Madonna and Child and a saint",
  },
  {
    file: "Spoleto Bridge and Castle.jpg",
    alt: "The walls of the Rocca Albornoziana above a wooded slope, with a path along the rampart",
  },
  {
    file: "spoleto castello.jpg",
    alt: "The stone towers and arched entrance of the Rocca Albornoziana",
  },
  {
    file: "spoleto bridge from above.jpg",
    alt: "The Ponte delle Torri from above, its tall arches crossing a densely wooded gorge",
  },
  {
    file: "Spoleto Roman Fountain.jpg",
    alt: "A stone wall fountain in Spoleto, with a carved mask pouring into the basin",
  },
  {
    file: "Albaccio Felice Spoleto.jpg",
    alt: "The open doorway of Al Bacco Felice, a restaurant in Spoleto",
  },
  {
    file: "Bottega in Spoleto.jpg",
    alt: "Hams hanging above the counter inside La Bottega di Spoleto",
  },
  {
    file: "spoleto view from castello.jpg",
    alt: "Spoleto and the valley below, seen from the walls of the Rocca, with mountains beyond",
  },
  {
    file: "Spoleto Bridge .jpg",
    alt: "The arches of the Ponte delle Torri against the wooded slopes of Monteluco",
  },
  {
    file: "Spoleto Walkway.jpg",
    alt: "Escalators and a moving walkway inside Spoleto's covered pedestrian link",
  },
  {
    file: "Filippo Lippi Madonna Spoleto.jpg",
    alt: "The Annunciation in Filippo Lippi's frescoes in Spoleto Cathedral, the angel kneeling before Mary",
  },
];

const HANDLES = [
  "@labottegadispoleto",
  "@iltempiodelgusto__",
  "@palazzo_leti_spoleto",
  "@hoteldeiduchi",
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
  if (url.searchParams.get("utm_source") !== "chatgpt.com") return href;
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
    const italic = /<w:i\/>|<w:i w:val="(1|true|on)"\/>/.test(props);
    const text = [...run.replace(/<w:br\b[^>]*\/?>/g, "<w:t>\n</w:t>").matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((part) => decodeXml(part[1]))
      .join("");
    return { bold, italic, href, text };
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
    const contentRuns = runs.filter((run) => run.text.trim());
    const allBold = contentRuns.length > 0 && contentRuns.every((run) => run.bold);
    paragraphs.push({ runs, text, images, allBold });
  }
  return paragraphs;
}

function paragraphHtml(runs) {
  const segments = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = segments[segments.length - 1];
    if (prev && prev.bold === run.bold && prev.italic === run.italic && prev.href === run.href) prev.text += run.text;
    else segments.push({ ...run });
  }
  return segments
    .map((seg) => {
      if (seg.href) return link(seg.href, seg.text.trim());
      const text = escapeHtml(seg.text).replace(/\n/g, "<br>");
      if ((!seg.bold && !seg.italic) || !seg.text.trim()) return text;
      const lead = text.match(/^\s*/)[0];
      const tail = text.match(/\s*$/)[0];
      let core = text.trim();
      if (seg.italic) core = `<em>${core}</em>`;
      if (seg.bold) core = `<strong>${core}</strong>`;
      return `${lead}${core}${tail}`;
    })
    .join("")
    .trim();
}

function linkPhrase(html, phrase, href) {
  const strong = `<strong>${escapeHtml(phrase)}</strong>`;
  const anchored = `<a href="${escapeHtml(cleanUrl(href))}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(phrase)}</strong></a>`;
  if (html.includes(strong)) return html.replace(strong, anchored);
  const plain = escapeHtml(phrase);
  if (!html.includes(plain)) throw new Error(`Could not link phrase: ${phrase}`);
  return html.replace(plain, link(href, phrase));
}

function lastParagraph(parts) {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].startsWith("<p>")) return i;
  }
  return -1;
}

function attachUrl(parts, href) {
  const prev = lastParagraph(parts);
  if (prev === -1) throw new Error(`URL with no previous paragraph: ${href}`);
  const url = cleanUrl(href);

  if (url === BOOK_HREF) {
    const titleOnly =
      parts[prev] === `<p>${escapeHtml(BOOK_PHRASE)}</p>` ||
      parts[prev] === `<p><strong>${escapeHtml(BOOK_PHRASE)}</strong></p>`;
    if (!titleOnly) throw new Error("Book URL did not follow its title");
    parts[prev] = `<p>${link(BOOK_HREF, BOOK_PHRASE)}</p>`;
    return;
  }

  if (url === COLLECTION_HREF) {
    const needle = `${escapeHtml("Real Travel Guides collection")}:`;
    if (!parts[prev].includes(needle)) throw new Error("Collection URL did not follow its sentence");
    parts[prev] = parts[prev].replace(needle, `${link(COLLECTION_HREF, "Real Travel Guides collection")}.`);
    return;
  }

  if (url === CULTURA_HREF) {
    const inner = parts[prev].slice(3, -4);
    if (!inner.trim().endsWith("at:")) throw new Error(`Cannot attach Spoleto Cultura to: ${inner.slice(0, 80)}`);
    parts[prev] = `<p>${inner} ${link(CULTURA_HREF, CULTURA_HREF)}</p>`;
    return;
  }

  if (url === FESTIVAL_HREF) {
    parts.push(`<p>${link(FESTIVAL_HREF, FESTIVAL_HREF)}</p>`);
    return;
  }

  if (url === TRENITALIA_HREF) {
    const inner = parts[prev].slice(3, -4);
    if (!inner.trim().endsWith("tickets:")) throw new Error(`Cannot attach Trenitalia to: ${inner.slice(0, 80)}`);
    parts[prev] = `<p>${inner} ${link(TRENITALIA_HREF, "Trenitalia")}</p>`;
    return;
  }

  throw new Error(`No link rule for ${url}`);
}

function buildBody(paragraphs) {
  const parts = [];
  const seenHeadings = new Set();
  let photo = 0;

  for (const para of paragraphs) {
    if (para.text === "Facebook" || para.text.includes("[ADD BLOG LINK]")) break;

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

    if (para.allBold && !H2.has(text) && !H3.has(text) && !KEEP_BOLD.has(text)) {
      throw new Error(`Unclassified bold paragraph: ${text}`);
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

    if (/^https?:\/\//i.test(text)) {
      const href = cleanUrl(para.runs.find((run) => run.href)?.href || text);
      attachUrl(parts, href);
      continue;
    }

    let html = paragraphHtml(para.runs);
    if (text.includes(`Our best-selling ${BOOK_PHRASE} guide`)) {
      html = linkPhrase(html, BOOK_PHRASE, BOOK_HREF);
    }
    parts.push(`<p>${html}</p>`);
  }

  if (photo !== PHOTOS.length) throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
  const missing = [...H2, ...H3].filter((heading) => !seenHeadings.has(heading));
  if (missing.length) {
    throw new Error(`Unmatched headings:\n${missing.map((heading) => `  - ${heading}`).join("\n")}`);
  }
  const closing = "Because some of Italy's most memorable places are only a short train journey away.";
  if (!parts.at(-1)?.includes(escapeHtml(closing))) {
    throw new Error("Article did not end with the document's closing sentence");
  }
  return parts.join("\n");
}

function estimateReadMinutes(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { minutes: Math.max(1, Math.round(words / 200)), words };
}

async function assertImagesExist() {
  const files = [...PHOTOS.map((photo) => photo.file), COVER_FILE];
  const missing = files.filter((file) => !existsSync(path.join(FOLDER, file)));
  if (missing.length) {
    throw new Error(`Missing image files:\n${missing.map((file) => `  - ${file}`).join("\n")}`);
  }
  const hero = statSync(path.join(FOLDER, HERO_FILE));
  if (hero.size !== HERO_BYTES) throw new Error(`Hero original size changed: ${hero.size}`);
  const coverStat = statSync(path.join(FOLDER, COVER_FILE));
  const coverMeta = await sharp(path.join(FOLDER, COVER_FILE)).metadata();
  if (coverMeta.width !== 1200 || coverMeta.height !== 630) {
    throw new Error(`Social cover is ${coverMeta.width}x${coverMeta.height}, expected 1200x630`);
  }
  if (coverStat.size >= 1024 * 1024) throw new Error(`Social cover is too large: ${coverStat.size}`);
  console.log(`Hero original bytes: ${hero.size}`);
  console.log(`Social cover: ${coverMeta.width}x${coverMeta.height} ${coverStat.size} bytes`);
  console.log("Photographs:");
  for (const photo of PHOTOS) {
    const full = path.join(FOLDER, photo.file);
    const meta = await sharp(full).metadata();
    const size = statSync(full).size;
    if (size >= 1024 * 1024) throw new Error(`Body image is multi-megabyte: ${photo.file} ${size}`);
    console.log(`  ${photo.file} | ${meta.width}x${meta.height} | ${size}`);
  }
}

function assertBody(body) {
  const visible = body.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ").replace(/<[^>]+>/g, " ");
  if (/https?:\/\//i.test(visible)) throw new Error("Bare URL left in visible text");
  if (body.includes("utm_source")) throw new Error("utm_source left in body");
  if (body.includes(encodeURI(HERO_FILE)) || body.includes(HERO_FILE)) {
    throw new Error("Hero photograph was repeated in the body");
  }
  if (body.includes(COVER_FILE) || body.includes(encodeURI(COVER_FILE))) {
    throw new Error("Social cover was placed in the body");
  }
  if (body.includes("[ADD BLOG LINK]") || body.includes(">Facebook<")) {
    throw new Error("Social caption leaked into the article");
  }
  if (JSON.stringify(CATEGORIES) !== JSON.stringify(["italy", "culture"])) {
    throw new Error("Categories must be italy and culture only");
  }
  const figures = (body.match(/<figure>/g) || []).length;
  if (figures !== PHOTOS.length - 1) throw new Error(`Expected ${PHOTOS.length - 1} figures, found ${figures}`);
  for (const handle of HANDLES) {
    if (!body.includes(handle)) throw new Error(`Missing handle: ${handle}`);
  }
  if ((body.match(/instagram\.com/g) || []).length) throw new Error("Unexpected Instagram URL");
  if (!body.includes("<em>Longobards in Italy: Places of Power</em>")) {
    throw new Error("Missing italic UNESCO listing title");
  }
  if (!body.includes("<em>metropolitana pedonale</em>")) throw new Error("Missing italic metropolitana pedonale");
  const counts = {
    cultura: (body.match(/href="https:\/\/www\.spoletocultura\.it"/g) || []).length,
    festival: (body.match(/href="https:\/\/www\.festivaldispoleto\.com"/g) || []).length,
    trenitalia: (body.match(/href="https:\/\/www\.trenitalia\.com"/g) || []).length,
    book: (body.match(/href="https:\/\/mybook\.to\/TouringItalybyTrain"/g) || []).length,
    collection: (body.match(/href="https:\/\/mybook\.to\/RealTravelGuidesBooks"/g) || []).length,
  };
  const expected = { cultura: 1, festival: 1, trenitalia: 1, book: 2, collection: 1 };
  for (const [key, count] of Object.entries(expected)) {
    if (counts[key] !== count) throw new Error(`Expected ${count} ${key} links, found ${counts[key]}`);
  }
  const h2 = (body.match(/<h2>/g) || []).length;
  const h3 = (body.match(/<h3>/g) || []).length;
  if (h2 !== H2.size || h3 !== H3.size) throw new Error(`Heading count h2 ${h2}/${H2.size} h3 ${h3}/${H3.size}`);
  const anchors = body.match(/<a href="[^"]+"/g) || [];
  if (anchors.length !== 6) {
    throw new Error(`Unexpected anchor count ${anchors.length}:\n${anchors.join("\n")}`);
  }
  if (!body.includes('rel="noopener noreferrer"') || !body.includes('target="_blank"')) {
    throw new Error("Links are missing target or rel");
  }
  if ((body.match(/<figure><img [^>]*loading="lazy" decoding="async"/g) || []).length !== figures) {
    throw new Error("A figure is missing lazy loading");
  }
  return counts;
}

async function assertDatabaseReady(supabase) {
  const { data: cats, error: catError } = await supabase.from("categories").select("slug,label");
  if (catError) throw catError;
  for (const slug of CATEGORIES) {
    const row = (cats || []).find((cat) => cat.slug === slug);
    if (!row) throw new Error(`Category slug does not exist: ${slug}`);
    console.log(`Category ${slug}: ${row.label}`);
  }
  for (const slug of [SLUG, "spoleto-day-trip-by-train"]) {
    const { data: existing, error } = await supabase.from("posts").select("slug").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (slug === SLUG && existing) throw new Error(`Post already exists: ${SLUG}`);
    console.log(`${slug}: ${existing ? "taken" : "free"}`);
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
  if (JSON.stringify(CATEGORIES) !== JSON.stringify(["italy", "culture"])) {
    throw new Error("Categories must be italy and culture only");
  }
  await assertImagesExist();
  const paragraphs = readDocxParagraphs(DOC);
  if (paragraphs[0]?.text !== TITLE) throw new Error(`Title mismatch: ${paragraphs[0]?.text}`);
  const body = buildBody(paragraphs);
  const counts = assertBody(body);
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
  console.log(`Links: ${JSON.stringify(counts)}`);
  console.log(`Excerpt: ${record.excerpt}`);

  if (DRY_RUN) {
    writeFileSync("scripts/_spoleto-body.html", body, "utf8");
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await assertDatabaseReady(supabase);

  const { error } = await supabase.from("posts").insert(record);
  if (error) throw error;

  const { data: row, error: readError } = await supabase
    .from("posts")
    .select("slug,title,categories,published_at,cover,images,excerpt,body,read_minutes")
    .eq("slug", SLUG)
    .single();
  if (readError) throw readError;
  const stored = row.body || "";
  console.log("\nVerified row:");
  console.log(`slug: ${row.slug}`);
  console.log(`title: ${row.title}`);
  console.log(`categories: ${JSON.stringify(row.categories)}`);
  console.log(`published_at: ${row.published_at}`);
  console.log(`cover: ${row.cover}`);
  console.log(`images: ${JSON.stringify(row.images)}`);
  console.log(`read_minutes: ${row.read_minutes}`);
  console.log(`excerpt: ${row.excerpt}`);
  console.log(`figures: ${(stored.match(/<figure>/g) || []).length}`);
  console.log(`trenitalia: ${(stored.match(/trenitalia\.com/g) || []).length}`);
  console.log(`book: ${(stored.match(/TouringItalybyTrain/g) || []).length}`);
  console.log(`collection: ${(stored.match(/RealTravelGuidesBooks/g) || []).length}`);
  console.log(`cultura: ${(stored.match(/spoletocultura\.it/g) || []).length}`);
  console.log(`festival: ${(stored.match(/festivaldispoleto\.com/g) || []).length}`);
  if (row.title !== TITLE) throw new Error("Stored title mismatch");
  if (JSON.stringify(row.categories) !== JSON.stringify(CATEGORIES)) throw new Error("Stored categories mismatch");
  if (String(row.published_at).slice(0, 10) !== PUBLISHED_AT) throw new Error(`Stored date mismatch: ${row.published_at}`);
  if (row.cover !== record.cover) throw new Error("Stored cover mismatch");
  if (row.images !== null) throw new Error("Stored images was not null");
  if (row.excerpt !== EXCERPT) throw new Error("Stored excerpt mismatch");
  if ((stored.match(/<figure>/g) || []).length !== PHOTOS.length - 1) throw new Error("Stored figure count mismatch");
  console.log(`\nPublished /post/${SLUG}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
