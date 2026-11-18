import { readFileSync } from "node:fs";

const html = readFileSync("scripts/_live-article.html", "utf8");
const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "";
const cover = "/images/blog/munich-to-milan-and-rome-by-frecciarossa/frecciarossa-cable-bridge.jpg";
const bodyFiles = [
  "frecciarossa-tunnel.jpg",
  "alpine-valley-meadows.jpg",
  "frecciarossa-leather-seats.jpg",
  "frecciarossa-paired-seats.jpg",
  "frecciarossa-executive-seats.jpg",
  "munich-marienplatz-sunset.jpg",
  "innsbruck-river-mountains.jpg",
  "bolzano-cathedral-square.jpg",
  "verona-river-adige.jpg",
  "milan-centrale.jpg",
  "bologna-twin-towers.jpg",
  "florence-arno-sunset.jpg",
  "rome-colosseum-sunset.jpg",
  "frecciarossa-carriage-logo.jpg",
];

function count(needle) {
  return html.split(needle).length - 1;
}

console.log(`TITLE ${title}`);
console.log(`H1 ${h1.replace(/<[^>]+>/g, "")}`);
console.log(`COVER_PRESENT ${html.includes(cover)}`);
console.log(`NEXT_IMAGE ${count("/_next/image")}`);
console.log(`PLAIN_IMG_SRC ${count('src="/images/blog/munich')}`);
console.log(`LAZY ${count("loading=\"lazy\"")}`);

for (const file of bodyFiles) {
  const plain = html.includes(`/images/blog/munich-to-milan-and-rome-by-frecciarossa/${file}`);
  const encoded = html.includes(encodeURIComponent(`/images/blog/munich-to-milan-and-rome-by-frecciarossa/${file}`));
  const next = html.includes("/_next/image") && (plain || encoded);
  console.log(`IMG ${file} plain=${plain} encoded=${encoded} viaNext=${next}`);
}

const links = [
  "https://www.trenitalia.com/",
  "https://www.bahn.de/",
  "https://www.oebb.at/en/",
  "/books#touring-italy-by-train",
  "https://www.realtravelguides.com/books",
];
for (const link of links) console.log(`LINK ${html.includes(link) ? "yes" : "NO"} ${link}`);

const bad = ["touring-germany", "touring-austria", "/books#touring-germany", "/books#touring-austria", "href=\"#\""];
for (const item of bad) console.log(`BAD ${html.includes(item) ? "FOUND" : "absent"} ${item}`);

console.log(`FIGCAPTION ${count("<figcaption")}`);
console.log(`BYTES ${html.length}`);
