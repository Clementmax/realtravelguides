/**
 * Extract rotated JPEG previews so each photograph can be described.
 * Previews stay out of public/.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";

const DOC =
  "c:\\Users\\carol\\OneDrive\\KPI\\REAL TRAVEL GUIDES\\BLOG CONTENT\\Munich to Milan and Rome by Frecciarossa.docx";
const OUT = path.join("scripts", "_munich-src");

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

const unzip = unzipDocx(readFileSync(DOC));
mkdirSync(OUT, { recursive: true });
for (let i = 1; i <= 15; i += 1) {
  const source = unzip[`word/media/image${i}.jpeg`];
  if (!source) throw new Error(`missing image${i}`);
  const rotated = sharp(source, { failOn: "none" }).rotate();
  const meta = await rotated.metadata();
  const preview = await sharp(source, { failOn: "none" })
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
  const file = path.join(OUT, `image${i}.jpg`);
  writeFileSync(file, preview);
  console.log(`image${i} original ${meta.width}x${meta.height} orientation=${meta.orientation ?? "n/a"} preview=${preview.length}`);
}
