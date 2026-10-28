/**
 * Temporary extractor. Do not commit.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\48 Hours in Florence This Autumn.docx";
const outDir = path.join("scripts", "_florence-media");

function unzip(buffer) {
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

const unzipped = unzip(readFileSync(DOC));
mkdirSync(outDir, { recursive: true });
const media = Object.keys(unzipped).filter((key) => key.startsWith("word/media/"));
console.log("MEDIA COUNT", media.length);
for (const name of media) {
  const base = path.basename(name);
  writeFileSync(path.join(outDir, base), unzipped[name]);
  console.log(base, unzipped[name].length);
}

const xml = unzipped["word/document.xml"].toString("utf8");
const rels = unzipped["word/_rels/document.xml.rels"].toString("utf8");
const relMap = {};
for (const match of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  relMap[match[1]] = decodeXml(match[2]);
}
const body = xml.match(/<w:body[\s\S]*<\/w:body>/)[0];
const lines = [];
let i = 0;
for (const block of body.split(/<w:p[ >]/).slice(1)) {
  const images = [...block.matchAll(/r:embed="([^"]+)"/g)].map((match) => relMap[match[1]] || match[1]);
  const drawings = (block.match(/<w:drawing[\s\S]*?<\/w:drawing>/g) || []).length;
  const withBreaks = block.replace(/<w:br\b[^>]*\/?>/g, "<w:t>\n</w:t>");
  const text = [...withBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("")
    .trim();
  const links = [...block.matchAll(/<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g)].map(
    (match) => {
      const label = [...match[2].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((part) => decodeXml(part[1]))
        .join("");
      return `${label} -> ${relMap[match[1]] || match[1]}`;
    }
  );
  const runs = [...block.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].map((match) => {
    const run = match[0];
    const props = (run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [""])[0];
    const bold = /<w:b\/>|<w:b w:val="(1|true|on)"\/>/.test(props);
    const runText = [...run.replace(/<w:br\b[^>]*\/?>/g, "<w:t>\n</w:t>").matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((part) => decodeXml(part[1]))
      .join("");
    return { bold, text: runText };
  });
  const contentRuns = runs.filter((run) => run.text.trim());
  const allBold = contentRuns.length > 0 && contentRuns.every((run) => run.bold);
  if (!text && !images.length) continue;
  i += 1;
  lines.push(`---P${i}${allBold ? " ALLBOLD" : ""} drawings=${drawings}`);
  if (images.length) lines.push(`IMAGES: ${images.join(", ")}`);
  if (text) lines.push(text);
  if (links.length) lines.push(`LINKS: ${links.join(" | ")}`);
  if (contentRuns.some((run) => run.bold) && !allBold) {
    lines.push(`BOLD RUNS: ${contentRuns.filter((run) => run.bold).map((run) => JSON.stringify(run.text)).join(" || ")}`);
  }
}
writeFileSync(path.join(outDir, "_text.txt"), lines.join("\n"), "utf8");
console.log("PARAS", i);
console.log("OTHER FILES", Object.keys(unzipped).filter((key) => !key.startsWith("word/media/")).join(", "));
