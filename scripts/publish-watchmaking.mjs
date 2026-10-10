/**
 * Publish "Into Switzerland's Watchmaking Country by Train".
 *
 * Images stay in public/images/blog/switzerlands-watchmaking-country-by-train/
 * Cover is the 1200×630 social crop of the first photograph, not repeated in the body.
 *
 * Usage:
 *   node --use-system-ca scripts/publish-watchmaking.mjs --dry-run
 *   node --use-system-ca scripts/publish-watchmaking.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Into Switzerlands Watch Making Country by Train.docx";

const SLUG = "switzerlands-watchmaking-country-by-train";
const TITLE =
  "Into Switzerland\u2019s Watchmaking Country by Train: Neuch\u00e2tel, La Chaux-de-Fonds and Le Locle";
const EXCERPT =
  "A three-day rail journey from Lake Neuch\u00e2tel into the Jura, through La Chaux-de-Fonds and Le Locle, where the towns themselves were built for watchmaking.";
const CATEGORIES = ["switzerland", "culture"];
const PUBLISHED_AT = "2026-10-10";
const IMAGE_DIR = "/images/blog/switzerlands-watchmaking-country-by-train";
const FOLDER = path.join("public", "images", "blog", "switzerlands-watchmaking-country-by-train");
const COVER_FILE = "Neuchatel vineyard lake view-social.jpg";
const HERO_FILE = "Neuchatel vineyard lake view.jpg";
const BOOK_HREF = "https://mybook.to/SwitzerlandByTrain";
const COLLECTION_HREF = "https://mybook.to/RealTravelGuidesBooks";
const BOOK_PHRASE = "Touring Switzerland by Train";

const H2 = new Set([
  "The Journey at a Glance",
  "Day 1: Begin Beside Lake Neuch\u00e2tel",
  "Where to Eat in Neuch\u00e2tel",
  "Where to Stay in Neuch\u00e2tel",
  "Day 2: Neuch\u00e2tel to La Chaux-de-Fonds",
  "Where to Eat in La Chaux-de-Fonds",
  "Where to Stay in La Chaux-de-Fonds",
  "Day 3: La Chaux-de-Fonds to Le Locle",
  "Where to Eat in Le Locle",
  "Starting in Paris?",
  "Where Next?",
  "When to Go",
  "Booking the Journey",
  "Why Take This Journey?",
  "Explore More of Switzerland by Rail",
]);

const H3 = new Set([
  "A Hidden Link to the Story Ahead",
  "Hidden Gem: Take the Funicular Above the Lake",
  "The City Built for Watchmakers",
  "Step Inside the World of Swiss Time",
  "The Other La Chaux-de-Fonds: Art Nouveau",
  "Hidden Gem: Le Corbusier Before Le Corbusier",
  "Ch\u00e2teau des Monts: Watches in a Watchmaker's Mansion",
  "The Hidden Gem Beneath the Jura",
]);

const KEEP_BOLD = new Set([
  "Paris \u2192 Neuch\u00e2tel \u2192 La Chaux-de-Fonds \u2192 Le Locle \u2192 Bern",
  "Paris \u2192 Neuch\u00e2tel \u2192 La Chaux-de-Fonds \u2192 Le Locle \u2192 Basel",
  BOOK_PHRASE,
]);

/** Document order. The first photograph is the hero and is not repeated in the body. */
const PHOTOS = [
  {
    file: HERO_FILE,
    alt: "A chapel in the vineyards above Lake Neuch\u00e2tel, with a wooded island in the turquoise water",
  },
  {
    file: "lake-neuchatel.jpg",
    alt: "Neuch\u00e2tel and Lake Neuch\u00e2tel seen from the forested ridge above the town, with the Alps beyond",
  },
  {
    file: "Neuchatel Market Square.jpg",
    alt: "Caf\u00e9 tables in a square of yellow stone houses in Neuch\u00e2tel, with pointed turrets and a wooded hill behind",
  },
  {
    file: "Neuchatel Medieval Old Town.jpg",
    alt: "A gilded griffin on a column in Neuch\u00e2tel's old town, among yellow limestone houses and a clock tower",
  },
  {
    file: "la-chaux-de-fonds-station-clock.jpg",
    alt: "Oversized watch faces in the square outside the stone station at La Chaux-de-Fonds",
  },
  {
    file: "la-chaux-de-fonds-station.jpg",
    alt: "An SBB train at the platforms in La Chaux-de-Fonds, with hillside apartment buildings behind the tracks",
  },
];

const HANDLES = [
  "@bainsdesdames",
  "@hotelbeaulac",
  "@beaurivageneuchatel",
  "@jindamour_lachauxdefonds",
  "@lesendroits",
  "@chezsandrolelocle",
  "@leliondorlelocle",
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

function linkExistingPhrase(parts, phrase, href) {
  const strong = `<strong>${escapeHtml(phrase)}</strong>`;
  const plain = escapeHtml(phrase);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (!parts[i].startsWith("<p>")) continue;
    if (!parts[i].includes(strong) && !parts[i].includes(plain)) continue;
    if (parts[i].includes(`>${escapeHtml(phrase)}</a>`) || parts[i].includes(`>${escapeHtml(phrase)}</strong></a>`)) {
      throw new Error(`Phrase already linked: ${phrase}`);
    }
    parts[i] = linkPhrase(parts[i], phrase, href);
    return;
  }
  throw new Error(`Phrase not found: ${phrase}`);
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

  if (url === "https://www.mih.ch") {
    linkExistingPhrase(parts, "Mus\u00e9e International d'Horlogerie", url);
    return;
  }
  if (url === "https://maisonblanche.ch") {
    linkExistingPhrase(parts, "Maison Blanche", url);
    return;
  }
  if (url === "https://www.mhl-monts.ch") {
    linkExistingPhrase(parts, "Mus\u00e9e d'horlogerie du Locle \u2013 Ch\u00e2teau des Monts", url);
    return;
  }
  if (url === "https://www.lesmoulins.ch") {
    linkExistingPhrase(parts, "Col-des-Roches", url);
    return;
  }

  const operators = {
    "https://www.sbb.ch": "SBB",
    "https://www.sncf-connect.com": "SNCF Connect",
  };
  const name = operators[url];
  if (!name) throw new Error(`No link rule for ${url}`);

  const inner = parts[prev].slice(3, -4);
  if (inner.includes(escapeHtml(name))) {
    parts[prev] = linkPhrase(parts[prev], name, url);
    return;
  }
  if (name === "SNCF Connect" && inner.includes("TGV Lyria sector")) {
    parts.push(`<p>${link(url, name)}</p>`);
    return;
  }
  if (!/[.:]$/.test(inner.trim())) throw new Error(`Cannot attach ${name} to: ${inner.slice(0, 80)}`);
  parts[prev] = `<p>${inner} ${link(url, name)}</p>`;
}

function buildBody(paragraphs) {
  const parts = [];
  const seenHeadings = new Set();
  let photo = 0;
  let stopped = false;

  for (const para of paragraphs) {
    if (para.text === "Facebook") {
      stopped = true;
      break;
    }

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

  if (!stopped) throw new Error("Did not find the Facebook caption section that ends the article");
  if (photo !== PHOTOS.length) throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
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
  const hero = statSync(path.join(FOLDER, HERO_FILE));
  const cover = statSync(path.join(FOLDER, COVER_FILE));
  if (hero.size !== 146855) throw new Error(`Hero original size changed: ${hero.size}`);
  if (cover.size >= 1024 * 1024) throw new Error(`Social cover is too large: ${cover.size}`);
  console.log(`Hero original bytes: ${hero.size}`);
  console.log(`Social cover bytes: ${cover.size}`);
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
  if (body.includes("[ADD BLOG LINK]") || body.includes("#SwitzerlandByTrain") || body.includes(">Facebook<")) {
    throw new Error("Social caption leaked into the article");
  }
  if (/\bexperiences\b/i.test(body) || CATEGORIES.includes("experiences")) {
    throw new Error("Experiences category or wording was introduced");
  }
  const figures = (body.match(/<figure>/g) || []).length;
  if (figures !== PHOTOS.length - 1) throw new Error(`Expected ${PHOTOS.length - 1} figures, found ${figures}`);
  for (const handle of HANDLES) {
    if (!body.includes(handle)) throw new Error(`Missing handle: ${handle}`);
  }
  if ((body.match(/instagram\.com/g) || []).length) throw new Error("Unexpected Instagram URL");
  const counts = {
    sbb: (body.match(/sbb\.ch/g) || []).length,
    sncf: (body.match(/sncf-connect\.com/g) || []).length,
    mih: (body.match(/mih\.ch/g) || []).length,
    blanche: (body.match(/maisonblanche\.ch/g) || []).length,
    monts: (body.match(/mhl-monts\.ch/g) || []).length,
    mills: (body.match(/lesmoulins\.ch/g) || []).length,
    book: (body.match(/SwitzerlandByTrain/g) || []).length,
    collection: (body.match(/RealTravelGuidesBooks/g) || []).length,
  };
  const expected = { sbb: 3, sncf: 2, mih: 1, blanche: 1, monts: 1, mills: 1, book: 2, collection: 1 };
  for (const [key, count] of Object.entries(expected)) {
    if (counts[key] !== count) throw new Error(`Expected ${count} ${key} links, found ${counts[key]}`);
  }
  const h2 = (body.match(/<h2>/g) || []).length;
  const h3 = (body.match(/<h3>/g) || []).length;
  if (h2 !== H2.size || h3 !== H3.size) throw new Error(`Heading count h2 ${h2}/${H2.size} h3 ${h3}/${H3.size}`);
  if (!body.includes("fermesdesbrandt.ch")) throw new Error("Missing plain-text farm website");
  const anchors = body.match(/<a href="[^"]+"/g) || [];
  if (anchors.length !== 12) {
    throw new Error(`Unexpected anchor count ${anchors.length}:\n${anchors.join("\n")}`);
  }
  return counts;
}

async function assertDatabaseReady(supabase) {
  const { data: cats, error: catError } = await supabase.from("categories").select("slug,label");
  if (catError) throw catError;
  const slugs = new Set((cats || []).map((cat) => cat.slug));
  if (slugs.has("experiences")) throw new Error("Unexpected experiences category exists; do not use it");
  for (const slug of CATEGORIES) {
    const row = (cats || []).find((cat) => cat.slug === slug);
    if (!row) throw new Error(`Category slug does not exist: ${slug}`);
    console.log(`Category ${slug}: ${row.label}`);
  }
  const { data: existing, error } = await supabase.from("posts").select("slug").eq("slug", SLUG).maybeSingle();
  if (error) throw error;
  if (existing) throw new Error(`Post already exists: ${SLUG}`);
  console.log(`Slug free: ${SLUG}`);

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
  if (JSON.stringify(CATEGORIES) !== JSON.stringify(["switzerland", "culture"])) {
    throw new Error("Categories must be switzerland and culture only");
  }
  assertImagesExist();
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
    writeFileSync("scripts/_watch-body.html", body, "utf8");
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
  console.log(`categories: ${(row.categories || []).join(", ")}`);
  console.log(`published_at: ${row.published_at}`);
  console.log(`cover: ${row.cover}`);
  console.log(`images: ${JSON.stringify(row.images)}`);
  console.log(`read_minutes: ${row.read_minutes}`);
  console.log(`excerpt: ${row.excerpt}`);
  console.log(`figures: ${(stored.match(/<figure>/g) || []).length}`);
  console.log(`sbb: ${(stored.match(/sbb\.ch/g) || []).length}`);
  console.log(`sncf: ${(stored.match(/sncf-connect\.com/g) || []).length}`);
  console.log(`book: ${(stored.match(/SwitzerlandByTrain/g) || []).length}`);
  console.log(`collection: ${(stored.match(/RealTravelGuidesBooks/g) || []).length}`);
  console.log(`\nPublished /post/${SLUG}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
