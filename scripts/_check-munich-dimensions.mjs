import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import dimensions from "../lib/body-image-dimensions.json" with { type: "json" };

const dir = path.join("public", "images", "blog", "munich-to-milan-and-rome-by-frecciarossa");
const files = readdirSync(dir).sort();
const cover = "frecciarossa-cable-bridge.jpg";
let problems = 0;
for (const file of files) {
  const full = path.join(dir, file);
  const meta = await sharp(full).metadata();
  const bytes = statSync(full).size;
  const src = `/images/blog/munich-to-milan-and-rome-by-frecciarossa/${file}`;
  const listed = dimensions[src];
  const inList = Boolean(listed);
  const match = listed && listed.width === meta.width && listed.height === meta.height;
  if (file === cover) {
    if (inList) {
      problems += 1;
      console.log(`PROBLEM cover is in the dimension list`);
    }
  } else if (!match) {
    problems += 1;
    console.log(`PROBLEM ${file} file ${meta.width}x${meta.height} listed ${listed ? `${listed.width}x${listed.height}` : "missing"}`);
  }
  console.log(`${file} ${bytes}B ${meta.width}x${meta.height} format=${meta.format} listed=${file === cover ? "cover-not-required" : match}`);
}
console.log(`files=${files.length} problems=${problems}`);
if (problems) process.exit(1);
