/**
 * Temporary image optimiser. Do not commit.
 */
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join("scripts", "_florence-media");
const DEST = path.join("public", "images", "blog", "48-hours-in-florence-this-autumn");

const FILES = [
  ["image1.jpg", "florence-duomo-campanile-window.jpg"],
  ["image2.jpeg", "florence-santa-maria-novella-train.jpg"],
  ["image3.jpeg", "aquaflor-perfumery-florence.jpg"],
  ["image4.jpeg", "schiacciateria-de-neri-florence.jpg"],
  ["image5.jpeg", "bargello-michelangelo-bacchus.jpg"],
  ["image6.jpeg", "bargello-painted-vault.jpg"],
  ["image7.jpeg", "bargello-gilded-praying-figure.jpg"],
  ["image8.jpeg", "oltrarno-antique-shop-window.jpg"],
  ["image9.jpeg", "brancacci-chapel-florence.jpg"],
  ["image10.jpeg", "brancacci-chapel-frescoes.jpg"],
  ["image11.jpeg", "palazzo-guadagni-loggia-florence.jpg"],
  ["image12.jpeg", "vini-e-vecchi-sapori-kitchen.jpg"],
  ["image13.jpeg", "florence-arno-palazzo-vecchio.jpg"],
  ["image14.jpeg", "quelo-bar-borgo-santa-croce.jpg"],
  ["image15.jpeg", "artemisia-gentileschi-oil-lamp.jpg"],
  ["image16.jpeg", "artemisia-gentileschi-exhibition-florence.jpg"],
  ["image17.jpeg", "artemisia-gentileschi-susanna-and-the-elders.jpg"],
  ["image18.jpeg", "sant-ambrogio-market-butcher.jpg"],
  ["image19.jpeg", "ponte-vecchio-arno-rowing.jpg"],
];

mkdirSync(DEST, { recursive: true });

function targetLongEdge(width, height) {
  const long = Math.max(width, height);
  if (long > 2000) return 1800;
  return null;
}

async function optimise(input, output) {
  const oriented = sharp(input, { failOn: "none" }).rotate();
  const meta = await oriented.metadata();
  const long = targetLongEdge(meta.width, meta.height);
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (long) {
    pipeline = pipeline.resize(long, long, { fit: "inside", withoutEnlargement: true });
  }
  let quality = 83;
  let info;
  for (const attempt of [83, 80]) {
    quality = attempt;
    info = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toFile(output);
    if (info.size < 900 * 1024) break;
  }
  return { srcW: meta.width, srcH: meta.height, ...info, quality };
}

async function social(input, output) {
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  const width = meta.width;
  const height = meta.height;
  const aspect = 1200 / 630;
  let cropWidth;
  let cropHeight;
  let left;
  let top;
  if (width / height > aspect) {
    cropHeight = height;
    cropWidth = Math.round(height * aspect);
    left = Math.round((width - cropWidth) / 2);
    top = 0;
  } else {
    cropWidth = width;
    cropHeight = Math.round(width / aspect);
    left = 0;
    const extra = height - cropHeight;
    // The Duomo and campanile sit in the open window, slightly above the geometric centre.
    top = Math.round(extra * 0.42);
  }
  cropWidth = Math.min(cropWidth, width - left);
  cropHeight = Math.min(cropHeight, height - top);
  const info = await sharp(input, { failOn: "none" })
    .rotate()
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(1200, 630, { fit: "fill" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(output);
  return { srcW: width, srcH: height, crop: { left, top, cropWidth, cropHeight }, ...info };
}

const rows = [];
for (const [source, name] of FILES) {
  const info = await optimise(path.join(SRC, source), path.join(DEST, name));
  rows.push({ name, ...info, bytes: statSync(path.join(DEST, name)).size });
}
const cover = await social(
  path.join(SRC, "image1.jpg"),
  path.join(DEST, "florence-duomo-campanile-window-social.jpg")
);
rows.push({
  name: "florence-duomo-campanile-window-social.jpg",
  width: cover.width,
  height: cover.height,
  bytes: statSync(path.join(DEST, "florence-duomo-campanile-window-social.jpg")).size,
  srcW: cover.srcW,
  srcH: cover.srcH,
  quality: 82,
  crop: cover.crop,
});

for (const row of rows) {
  console.log(
    [
      row.name,
      `${row.width}x${row.height}`,
      `${row.bytes}b`,
      `src ${row.srcW}x${row.srcH}`,
      `q${row.quality}`,
      row.crop ? `crop ${row.crop.left},${row.crop.top} ${row.crop.cropWidth}x${row.crop.cropHeight}` : "",
    ].join(" | ")
  );
}
