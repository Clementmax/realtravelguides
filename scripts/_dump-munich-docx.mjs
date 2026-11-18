/**
 * Dump paragraph text, links, and image order from the Munich docx.
 * Does not read or print environment secrets.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Munich to Milan and Rome by Frecciarossa.docx";
const OUT = path.join("scripts", "_munich-docx-dump.txt");

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

const unzip = unzipDocx(readFileSync(DOC));
const names = Object.keys(unzip).sort();
const xml = unzip["word/document.xml"].toString("utf8");
const rels = unzip["word/_rels/document.xml.rels"].toString("utf8");
const relMap = {};
for (const match of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  relMap[match[1]] = decodeXml(match[2]);
}
const styles = unzip["word/styles.xml"] ? unzip["word/styles.xml"].toString("utf8").slice(0, 200) : "";
const body = xml.match(/<w:body[\s\S]*<\/w:body>/)[0];
const lines = [];
lines.push("FILES:");
for (const name of names) lines.push(`  ${name} ${unzip[name].length}`);
lines.push("");
lines.push("RELS:");
for (const [id, target] of Object.entries(relMap)) lines.push(`  ${id} -> ${target}`);
lines.push("");
lines.push(`styles present: ${Boolean(unzip["word/styles.xml"])} ${styles ? "yes" : ""}`);
lines.push("");

let index = 0;
for (const block of body.split(/<w:p[ >]/).slice(1)) {
  const style = (block.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "";
  const images = [...block.matchAll(/r:embed="([^"]+)"/g)].map((match) => relMap[match[1]] || match[1]);
  const descr = [...block.matchAll(/descr="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const nameAttr = [...block.matchAll(/<wp:docPr[^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const runs = [];
  const pattern = /<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g;
  let last = 0;
  for (const match of block.matchAll(pattern)) {
    runs.push(...runsOf(block.slice(last, match.index)));
    runs.push(...runsOf(match[2], relMap[match[1]] || match[1]));
    last = match.index + match[0].length;
  }
  runs.push(...runsOf(block.slice(last)));
  const text = runs.map((run) => run.text).join("").replace(/[ \t]+/g, " ").trim();
  if (!text && !images.length) continue;
  index += 1;
  const flags = [];
  if (style) flags.push(`style=${style}`);
  const textual = runs.filter((r) => r.text.trim());
  if (textual.length && textual.every((r) => r.bold)) flags.push("ALLBOLD");
  if (textual.length && textual.every((r) => r.italic)) flags.push("ALLITALIC");
  lines.push(`--- P${index} ${flags.join(" ")}`);
  if (images.length) lines.push(`IMAGES: ${images.join(", ")}`);
  if (descr.length) lines.push(`DESCR: ${descr.join(" | ")}`);
  if (nameAttr.length) lines.push(`NAME: ${nameAttr.join(" | ")}`);
  if (text) lines.push(text);
  const linked = runs.filter((r) => r.href);
  for (const run of linked) {
    lines.push(`  LINK [${run.href}] ${JSON.stringify(run.text)}`);
  }
}

writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${OUT} paragraphs=${index} files=${names.length}`);
