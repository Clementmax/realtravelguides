import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const imageRoot = path.join(projectRoot, "public", "images", "blog");
const reportsDir = path.join(projectRoot, "reports");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(projectRoot, ".env.local"));
loadEnvFile(path.join(projectRoot, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Make sure your existing .env.local is in the project root.");
  process.exit(1);
}

if (!fs.existsSync(imageRoot)) {
  console.error(`Image folder not found: ${imageRoot}`);
  process.exit(1);
}

const supabase = createClient(url, anonKey);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","in","into","is","it","its","of","on","or","our","the","this","to","with","without","your","you",
  "how","why","what","when","where","best","guide","travel","travelling","trip","journey","journeys","train","trains","rail","railway","day","days","weekend",
  "escape","discover","discovering","explore","exploring","perfect","ultimate","city","town","route","spring","summer","autumn","winter"
]);

const ALIASES = {
  padua: ["padova"], padova: ["padua"], venice: ["venezia"], venezia: ["venice"],
  florence: ["firenze"], firenze: ["florence"], turin: ["torino"], torino: ["turin"],
  milan: ["milano"], milano: ["milan"], naples: ["napoli"], napoli: ["naples"],
  rome: ["roma"], roma: ["rome"], sicily: ["sicilia"], sicilia: ["sicily"],
  tuscany: ["toscana"], toscana: ["tuscany"], lucerne: ["luzern"], luzern: ["lucerne"],
  geneva: ["geneve"], geneve: ["geneva"], zurich: ["zuerich"], zuerich: ["zurich"],
  seville: ["sevilla"], sevilla: ["seville"]
};

function stripHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_–—-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  const tokens = normalizeText(value)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const expanded = new Set(tokens);
  for (const t of tokens) {
    for (const alias of ALIASES[t] || []) expanded.add(alias);
  }
  return expanded;
}

function listImages(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listImages(full));
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      const rel = path.relative(projectRoot, full).split(path.sep).join("/");
      const publicPath = "/" + rel.replace(/^public\//, "");
      out.push({
        name: entry.name,
        full,
        rel,
        publicPath,
        tokens: tokenize(path.basename(entry.name, path.extname(entry.name)))
      });
    }
  }
  return out;
}

function extractExistingImageRefs(body = "") {
  const refs = new Set();
  for (const m of body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) refs.add(m[1]);
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) refs.add(m[1]);
  return [...refs];
}

function normalizedRef(value = "") {
  try { value = decodeURIComponent(value); } catch {}
  return normalizeText(value.replace(/^https?:\/\/[^/]+/i, ""));
}

function isAlreadyUsed(image, post, existingRefs) {
  const candidate = normalizedRef(image.publicPath);
  const filename = normalizedRef(image.name);
  return [post.cover || "", ...existingRefs].some((ref) => {
    const n = normalizedRef(ref);
    return n && (n.includes(candidate) || n.includes(filename) || candidate.includes(n));
  });
}

function scoreImageForPost(image, post) {
  const titleTokens = tokenize(post.title || "");
  const slugTokens = tokenize(post.slug || "");
  const bodyTokens = tokenize(stripHtml(post.body || ""));
  const categoryTokens = tokenize((post.categories || []).join(" "));

  let score = 0;
  const reasons = [];
  for (const t of image.tokens) {
    if (titleTokens.has(t)) { score += 10; reasons.push(`${t}:title`); }
    else if (slugTokens.has(t)) { score += 8; reasons.push(`${t}:slug`); }
    else if (categoryTokens.has(t)) { score += 3; reasons.push(`${t}:category`); }
    else if (bodyTokens.has(t)) { score += 2; reasons.push(`${t}:body`); }
  }
  const uniqueMatched = new Set(reasons.map((r) => r.split(":")[0])).size;
  if (uniqueMatched >= 3) score += 8;
  else if (uniqueMatched === 2) score += 4;
  return { score, reasons, uniqueMatched };
}

function csvCell(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  console.log("Reading images from public/images/blog ...");
  const images = listImages(imageRoot);
  console.log(`Found ${images.length} image files.`);

  console.log("Reading posts from Supabase (read-only) ...");
  const { data: posts, error } = await supabase
    .from("posts")
    .select("slug,title,excerpt,cover,categories,read_minutes,published_at,body,video_url")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Supabase read failed:", error.message);
    process.exit(1);
  }

  const rows = [];
  const htmlSections = [];

  for (const post of posts || []) {
    const existingRefs = extractExistingImageRefs(post.body || "");
    const bodyImageCount = existingRefs.length;

    const candidates = images
      .filter((img) => !isAlreadyUsed(img, post, existingRefs))
      .map((img) => ({ img, ...scoreImageForPost(img, post) }))
      .filter((x) => x.score >= 10 && x.uniqueMatched >= 1)
      .sort((a, b) => b.score - a.score || a.img.name.localeCompare(b.img.name))
      .slice(0, 5);

    const suggested = candidates.slice(0, 3);

    rows.push({
      title: post.title,
      slug: post.slug,
      cover: post.cover || "",
      existing_body_images: bodyImageCount,
      suggested_1: suggested[0]?.img.publicPath || "",
      score_1: suggested[0]?.score || "",
      suggested_2: suggested[1]?.img.publicPath || "",
      score_2: suggested[1]?.score || "",
      suggested_3: suggested[2]?.img.publicPath || "",
      score_3: suggested[2]?.score || "",
      notes: bodyImageCount >= 3
        ? "Already has 3+ inline images — review before adding anything"
        : suggested.length === 0
        ? "No confident filename match found"
        : "Suggestions only — no changes made"
    });

    htmlSections.push(`
      <section class="post">
        <h2>${esc(post.title)}</h2>
        <div class="meta"><strong>Slug:</strong> ${esc(post.slug)}</div>
        <div class="meta"><strong>Current cover:</strong> ${esc(post.cover || "None")}</div>
        <div class="meta"><strong>Existing inline images:</strong> ${bodyImageCount}</div>
        ${suggested.length
          ? `<h3>Suggested images</h3><div class="grid">${suggested.map((s) => `
              <figure>
                <img src="${esc(s.img.publicPath)}" alt="${esc(s.img.name)}">
                <figcaption><strong>${esc(s.img.name)}</strong><br>Match score: ${s.score}<br>${esc(s.reasons.join(", "))}</figcaption>
              </figure>`).join("")}</div>`
          : `<p><em>No confident filename match found.</em></p>`}
        ${bodyImageCount >= 3 ? `<p class="warning">This article already contains 3 or more inline images. Leave it alone unless you specifically want more.</p>` : ""}
      </section>`);
  }

  fs.mkdirSync(reportsDir, { recursive: true });

  const csvHeaders = ["title","slug","cover","existing_body_images","suggested_1","score_1","suggested_2","score_2","suggested_3","score_3","notes"];
  const csv = [
    csvHeaders.map(csvCell).join(","),
    ...rows.map((row) => csvHeaders.map((h) => csvCell(row[h])).join(","))
  ].join("\n");

  fs.writeFileSync(path.join(reportsDir, "blog-image-audit.csv"), csv, "utf8");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Real Travel Guides — Blog Image Audit</title>
<style>
body{font-family:Arial,sans-serif;max-width:1180px;margin:40px auto;padding:0 24px;color:#222}
h1{margin-bottom:6px}.intro{color:#555;margin-bottom:32px}.post{border-top:1px solid #ddd;padding:28px 0}
.meta{margin:5px 0;word-break:break-all}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:15px}
figure{margin:0;border:1px solid #ddd;border-radius:8px;overflow:hidden;background:#fafafa}figure img{width:100%;height:190px;object-fit:cover;display:block}
figcaption{padding:10px;font-size:13px;line-height:1.4}.warning{background:#fff4d6;padding:10px 12px;border-radius:6px}
</style></head>
<body><h1>Real Travel Guides — Blog Image Audit</h1>
<p class="intro">Read-only report. No Supabase records were changed. It found ${images.length} files in <code>public/images/blog</code> and reviewed ${(posts || []).length} posts.</p>
${htmlSections.join("\n")}
</body></html>`;

  fs.writeFileSync(path.join(reportsDir, "blog-image-audit.html"), html, "utf8");

  console.log("");
  console.log("DONE — no Supabase data was changed.");
  console.log("CSV report:  reports/blog-image-audit.csv");
  console.log("HTML report: reports/blog-image-audit.html");
  console.log("");
  console.log("Open reports/blog-image-audit.html in your browser to review the suggested matches.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
