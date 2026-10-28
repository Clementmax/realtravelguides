/**
 * Publish "48 Hours in Florence This Autumn".
 * Local script only — do not commit.
 *
 * Images stay in public/images/blog/48-hours-in-florence-this-autumn/
 * Cover is the 1200×630 social crop of the first photograph, not repeated in the body.
 * Instagram and Facebook caption drafts at the end of the document are omitted.
 *
 * Usage:
 *   node --use-system-ca scripts/publish-florence.mjs --dry-run
 *   node --use-system-ca scripts/publish-florence.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\48 Hours in Florence This Autumn.docx";

const SLUG = "48-hours-in-florence-this-autumn";
const TITLE =
  "48 Hours in Florence This Autumn: Renaissance Masterpieces, Hidden Courtyards and the Art of Avoiding the Crowds";
const EXCERPT =
  "An autumn weekend in Florence by train, with the Bargello, the Brancacci Chapel, the Oltrarno and neighbourhood restaurants away from the longest queues.";
const CATEGORIES = ["italy", "culture"];
const PUBLISHED_AT = "2026-10-28";
const IMAGE_DIR = "/images/blog/48-hours-in-florence-this-autumn";
const FOLDER = path.join("public", "images", "blog", SLUG);
const COVER_FILE = "florence-duomo-campanile-window-social.jpg";
const HERO_FILE = "florence-duomo-campanile-window.jpg";
const BOOK_HREF = "https://mybook.to/TouringItalybyTrain";
const COLLECTION_HREF = "https://mybook.to/RealTravelGuidesBooks";
const BOOK_PHRASE = "Touring Italy by Train";

const H2 = new Set([
  "Day 1: Arriving in Florence by Train",
  "Day 2: Coffee, Artemisia Gentileschi and the Markets of Florence",
  "Why Autumn Is Such a Good Time to Visit Florence",
  "How to Visit Florence by Train",
  "Our Tips for 48 Hours in Florence",
  "Explore More of Italy by Train",
]);

const H3 = new Set([
  "Stay Near Santa Croce: Borgo Signature Rooms",
  "A Florentine Lunch: The Search for the Perfect Schiacciata",
  "The Bargello: Florence's Extraordinary Museum of Sculpture",
  "From Medieval Palace to Prison to Museum",
  "Donatello, Michelangelo and the Birth of Renaissance Sculpture",
  "Across the Arno: Discovering the Oltrarno",
  "The Brancacci Chapel: Where Renaissance Painting Changed Forever",
  "Adam and Eve Like You've Never Seen Them",
  "Booking the Brancacci Chapel",
  "Aperitivo Above Santo Spirito: Palazzo Guadagni",
  "Dinner at Vini e Vecchi Sapori: A Florentine Institution",
  "A Late-Night Cocktail at Quelo Bar",
  "Artemisia Gentileschi: A Remarkable Exhibition at the Museo degli Innocenti",
  "The Extraordinary Life of Artemisia Gentileschi",
  "Why This Exhibition Is Worth Seeing",
  "Lunch at Sant'Ambrogio Market: Trattoria da Rocco",
  "A Wander Through Sant'Ambrogio's Antique Market",
  "One Last Walk Through Florence",
]);

/** Document order. The first photograph is the cover and is not repeated in the body. */
const PHOTOS = [
  {
    file: HERO_FILE,
    alt: "The Duomo and Giotto's campanile seen through an open Gothic window in Florence",
  },
  {
    file: "florence-santa-maria-novella-train.jpg",
    alt: "A Trenitalia train at a platform in Florence Santa Maria Novella station",
  },
  {
    file: "aquaflor-perfumery-florence.jpg",
    alt: "The entrance to Aquaflor perfumery, with reed diffusers and ferns beside the wooden doors",
  },
  {
    file: "schiacciateria-de-neri-florence.jpg",
    alt: "A queue outside Schiacciateria de' Neri on a stone street in Florence",
  },
  {
    file: "bargello-michelangelo-bacchus.jpg",
    alt: "Michelangelo's marble Bacchus in a painted hall of the Bargello",
  },
  {
    file: "bargello-painted-vault.jpg",
    alt: "A gallery in the Bargello beneath a blue vault painted with gold stars and lions",
  },
  {
    file: "bargello-gilded-praying-figure.jpg",
    alt: "A gilded wooden figure of a praying woman in the Bargello, her shadow cast on the wall",
  },
  {
    file: "oltrarno-antique-shop-window.jpg",
    alt: "Classical busts, globes and a painted profile in an Oltrarno shop window",
  },
  {
    file: "brancacci-chapel-florence.jpg",
    alt: "The Brancacci Chapel, with frescoed walls and a gold Madonna and Child above the altar",
  },
  {
    file: "brancacci-chapel-frescoes.jpg",
    alt: "Frescoes on the wall of the Brancacci Chapel, including the Tribute Money and the Crucifixion of St Peter",
  },
  {
    file: "palazzo-guadagni-loggia-florence.jpg",
    alt: "Tables under orange awnings on the loggia of Palazzo Guadagni, looking over Florence's rooftops",
  },
  {
    file: "vini-e-vecchi-sapori-kitchen.jpg",
    alt: "Chefs working in the kitchen of Vini e Vecchi Sapori, seen through a metal screen",
  },
  {
    file: "florence-arno-palazzo-vecchio.jpg",
    alt: "The Arno in the evening, with the Ponte Vecchio and the tower of Palazzo Vecchio",
  },
  {
    file: "quelo-bar-borgo-santa-croce.jpg",
    alt: "Quelo Bar at night on Borgo Santa Croce, with the church lit at the end of the street",
  },
  {
    file: "artemisia-gentileschi-oil-lamp.jpg",
    alt: "A Baroque painting of a woman holding a lit oil lamp and looking toward a star",
  },
  {
    file: "artemisia-gentileschi-exhibition-florence.jpg",
    alt: "A visitor in a red-lit room where paintings are projected across the walls and floor",
  },
  {
    file: "artemisia-gentileschi-susanna-and-the-elders.jpg",
    alt: "Artemisia Gentileschi's Susanna and the Elders, with two men leaning over a wall above Susanna",
  },
  {
    file: "sant-ambrogio-market-butcher.jpg",
    alt: "A butcher's counter inside the covered market at Sant'Ambrogio",
  },
  {
    file: "ponte-vecchio-arno-rowing.jpg",
    alt: "Two people rowing on the Arno beside the Ponte Vecchio",
  },
];

const HANDLES = [
  "@borgo_signature_rooms",
  "@aquaflorfirenze",
  "@allanticovinaio",
  "@bargellomuseums",
  "@loggia_roofbar",
  "@vini_e_vecchi_sapori",
  "@trattoriadarocco",
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
  if (url.searchParams.has("utm_source")) url.searchParams.delete("utm_source");
  if ([...url.searchParams.keys()].length === 0) url.search = "";
  let out = url.toString();
  if (url.pathname === "/" && out.endsWith("/")) out = out.slice(0, -1);
  return out;
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
    const text = runs
      .map((run) => run.text)
      .join("")
      .trim();
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

function appendNamedLink(parts, href, name) {
  const prev = lastParagraph(parts);
  if (prev === -1) throw new Error(`URL with no previous paragraph: ${href}`);
  const inner = parts[prev].slice(3, -4);
  if (!/[.:]$/.test(inner.trim()) && !inner.includes("</a>")) {
    throw new Error(`Cannot attach ${name} to: ${inner.slice(0, 120)}`);
  }
  parts[prev] = `<p>${inner} ${link(href, name)}</p>`;
}

function attachUrl(parts, href) {
  const url = cleanUrl(href);
  const prev = lastParagraph(parts);
  if (prev === -1) throw new Error(`URL with no previous paragraph: ${url}`);

  if (url === BOOK_HREF) {
    const titleOnly =
      parts[prev] === `<p>${escapeHtml(BOOK_PHRASE)}</p>` ||
      parts[prev] === `<p><strong>${escapeHtml(BOOK_PHRASE)}</strong></p>`;
    if (!titleOnly) throw new Error("Book URL did not follow its title");
    parts[prev] = `<p>${link(BOOK_HREF, BOOK_PHRASE)}</p>`;
    return;
  }

  if (url === COLLECTION_HREF) {
    linkExistingPhrase(parts, "Real Travel Guides collection", url);
    return;
  }

  if (url === "https://musefirenze.it") {
    linkExistingPhrase(parts, "official Florence museums website", url);
    return;
  }
  if (url === "https://www.museodeglinnocenti.it") {
    linkExistingPhrase(parts, "Artemisia Gentileschi in Florence", url);
    return;
  }
  if (url === "https://www.daroccotrattoria.com") {
    linkExistingPhrase(parts, "Trattoria da Rocco", url);
    return;
  }
  if (url === "https://bargellomusei.it") {
    appendNamedLink(parts, url, "Bargello Museums");
    return;
  }
  if (url === "https://www.palazzoguadagni.com") {
    appendNamedLink(parts, url, "Palazzo Guadagni");
    return;
  }
  if (url === "https://www.trenitalia.com") {
    appendNamedLink(parts, url, "Trenitalia");
    return;
  }
  if (url === "https://www.italotreno.com") {
    if (!parts[prev].includes("trenitalia.com")) throw new Error("Italo URL did not follow Trenitalia");
    const inner = parts[prev].slice(3, -4);
    parts[prev] = `<p>${inner} ${link(url, "Italo")}</p>`;
    return;
  }

  throw new Error(`No link rule for ${url}`);
}

function labelLink(text) {
  const rules = [
    { label: "Borgo Signature Rooms", href: "https://firenzeborgo.com" },
    { label: "Aquaflor", href: "https://www.aquaflor.it" },
  ];
  for (const rule of rules) {
    const pattern = new RegExp(`^${rule.label}:\\s*https://`, "i");
    if (pattern.test(text)) return `<p>${link(rule.href, rule.label)}</p>`;
  }
  return null;
}

function buildBody(paragraphs) {
  const parts = [];
  const seenHeadings = new Set();
  let photo = 0;
  let stopped = false;

  for (const para of paragraphs) {
    if (para.text === "INSTAGRAM") {
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

    if (para.allBold && !H2.has(text) && !H3.has(text)) {
      throw new Error(`Unclassified bold paragraph: ${JSON.stringify(text)}`);
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

    const labelled = labelLink(text);
    if (labelled) {
      parts.push(labelled);
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

  if (!stopped) throw new Error("Did not find the Instagram caption section that ends the article");
  if (photo !== PHOTOS.length) throw new Error(`Expected ${PHOTOS.length} photographs, matched ${photo}`);
  const missing = [...H2, ...H3].filter((heading) => !seenHeadings.has(heading));
  if (missing.length) {
    throw new Error(`Unmatched headings:\n${missing.map((heading) => `  - ${heading}`).join("\n")}`);
  }
  return parts.join("\n");
}

function estimateReadMinutes(html) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { minutes: Math.max(1, Math.round(words / 200)), words };
}

async function assertImagesExist() {
  const files = [...PHOTOS.map((photo) => photo.file), COVER_FILE];
  const missing = files.filter((file) => !existsSync(path.join(FOLDER, file)));
  if (missing.length) {
    throw new Error(`Missing image files:\n${missing.map((file) => `  - ${file}`).join("\n")}`);
  }
  const coverPath = path.join(FOLDER, COVER_FILE);
  const cover = await sharp(coverPath).metadata();
  const bytes = statSync(coverPath).size;
  if (cover.width !== 1200 || cover.height !== 630) {
    throw new Error(`Social cover is ${cover.width}x${cover.height}, expected 1200x630`);
  }
  if (bytes >= 1024 * 1024) throw new Error(`Social cover is too large: ${bytes}`);
  console.log(`Social cover: ${cover.width}x${cover.height} ${bytes} bytes`);
  const hero = await sharp(path.join(FOLDER, HERO_FILE)).metadata();
  console.log(`Hero original-aspect: ${hero.width}x${hero.height} ${statSync(path.join(FOLDER, HERO_FILE)).size} bytes`);
}

function assertBody(body) {
  const visible = body
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  if (/https?:\/\//i.test(visible)) throw new Error("Bare URL left in visible text");
  if (body.includes("utm_source")) throw new Error("utm_source left in body");
  if (body.includes(HERO_FILE) || body.includes(encodeURI(HERO_FILE))) {
    throw new Error("Hero photograph was repeated in the body");
  }
  if (body.includes(COVER_FILE) || body.includes(encodeURI(COVER_FILE))) {
    throw new Error("Social cover was placed in the body");
  }
  if (
    body.includes("[ADD BLOG LINK]") ||
    body.includes("INSTAGRAM") ||
    body.includes("FACEBOOK") ||
    body.includes("link in bio") ||
    body.includes("#Florence") ||
    body.includes("#RealTravelGuides")
  ) {
    throw new Error("Social caption leaked into the article");
  }
  const figures = body.match(/<figure>/g) || [];
  if (figures.length !== PHOTOS.length - 1) {
    throw new Error(`Expected ${PHOTOS.length - 1} figures, found ${figures.length}`);
  }
  const srcs = [...body.matchAll(/src="([^"]+)"/g)].map((match) => match[1]);
  const expected = PHOTOS.slice(1).map((photo) => publicSrc(photo.file));
  if (srcs.join("\n") !== expected.join("\n")) {
    throw new Error(`Inline image order mismatch:\n${srcs.join("\n")}`);
  }
  for (const handle of HANDLES) {
    if (!body.includes(handle)) throw new Error(`Missing handle: ${handle}`);
  }
  if ((body.match(/instagram\.com/g) || []).length) throw new Error("Unexpected Instagram URL");
  if (!body.includes("<strong>Quelo Bar</strong>")) throw new Error("Quelo Bar bold label was lost");
  const h2 = (body.match(/<h2>/g) || []).length;
  const h3 = (body.match(/<h3>/g) || []).length;
  if (h2 !== H2.size || h3 !== H3.size) throw new Error(`Heading count h2 ${h2}/${H2.size} h3 ${h3}/${H3.size}`);
  const anchors = [...body.matchAll(/<a href="([^"]+)"/g)].map((match) => match[1]);
  const expectedLinks = [
    "https://firenzeborgo.com",
    "https://www.aquaflor.it",
    "https://bargellomusei.it",
    "https://musefirenze.it",
    "https://www.palazzoguadagni.com",
    "https://www.museodeglinnocenti.it",
    "https://www.daroccotrattoria.com",
    "https://www.trenitalia.com",
    "https://www.italotreno.com",
    BOOK_HREF,
    BOOK_HREF,
    COLLECTION_HREF,
  ];
  if (anchors.join("\n") !== expectedLinks.join("\n")) {
    throw new Error(`Unexpected links:\n${anchors.join("\n")}`);
  }
  if (!body.endsWith("</p>")) throw new Error("Article did not end on a paragraph");
  const closing = body.slice(body.lastIndexOf("<p>"));
  if (!closing.includes("RealTravelGuidesBooks") && !closing.includes("slow down")) {
    throw new Error(`Unexpected ending: ${closing.slice(0, 180)}`);
  }
  return anchors;
}

async function assertDatabaseReady(supabase) {
  const { data: cats, error: catError } = await supabase.from("categories").select("slug,label");
  if (catError) throw catError;
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
}

async function main() {
  if (JSON.stringify(CATEGORIES) !== JSON.stringify(["italy", "culture"])) {
    throw new Error("Categories must be italy and culture only");
  }
  await assertImagesExist();
  const paragraphs = readDocxParagraphs(DOC);
  if (paragraphs[0]?.text !== TITLE) throw new Error(`Title mismatch: ${paragraphs[0]?.text}`);
  const body = buildBody(paragraphs);
  const anchors = assertBody(body);
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
  console.log(`Links: ${anchors.length}`);
  console.log(`Excerpt: ${record.excerpt}`);
  console.log(`Ending: ${body.slice(body.lastIndexOf("<h2>"))}`);

  if (DRY_RUN) {
    console.log("\n[dry-run] Skipping database write.");
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  console.log(`hero in body: ${stored.includes(HERO_FILE)}`);
  console.log(`social in body: ${stored.includes(COVER_FILE)}`);
  console.log(`add blog link: ${stored.includes("[ADD BLOG LINK]")}`);
  console.log(`instagram section: ${stored.includes("INSTAGRAM")}`);
  console.log(`facebook section: ${stored.includes("FACEBOOK")}`);
  const storedLinks = [...stored.matchAll(/<a href="([^"]+)"/g)].map((match) => match[1]);
  console.log(`links: ${storedLinks.join(" | ")}`);
  console.log(`\nPublished https://www.realtravelguides.com/post/${SLUG}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message || err);
  process.exit(1);
});
