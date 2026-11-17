import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { parseFragment } from "parse5";
import { writeFile } from "node:fs/promises";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const slugs = [
  "a-summer-weekend-in-paris-by-train-how-to-experience-the-city-like-a-local",
  "naples-in-spring-a-foodie-weekend-by-train",
  "48-hours-in-florence-this-autumn",
];

const { data, error } = await supabase.from("posts").select("slug, title, body, images");
if (error) throw new Error(error.message);

const parentCounts = {};
let imgsInAnchor = 0;
let figuresWithCaption = 0;
let figuresWithoutCaption = 0;
const captionExamples = [];
const anchorExamples = [];
const outsideFigure = [];

function walk(node, fn) {
  fn(node);
  for (const child of node.childNodes || []) walk(child, fn);
}

for (const post of data) {
  const fragment = parseFragment(post.body || "");
  walk(fragment, (node) => {
    if (node.nodeName === "figure") {
      const hasCap = (node.childNodes || []).some((child) => child.nodeName === "figcaption");
      if (hasCap) figuresWithCaption += 1;
      else figuresWithoutCaption += 1;
      if (hasCap && captionExamples.length < 3) {
        const img = (node.childNodes || []).find((child) => child.nodeName === "img");
        const cap = (node.childNodes || []).find((child) => child.nodeName === "figcaption");
        const capText = (cap?.childNodes || [])
          .filter((child) => child.nodeName === "#text")
          .map((child) => child.value)
          .join("")
          .slice(0, 140);
        captionExamples.push({
          slug: post.slug,
          imgParent: img ? "figure" : (node.childNodes || []).map((child) => child.nodeName).join(","),
          alt: img?.attrs?.find((attr) => attr.name === "alt")?.value?.slice(0, 80) || null,
          caption: capText,
          childNames: (node.childNodes || []).map((child) => child.nodeName),
        });
      }
    }
    if (node.nodeName !== "img") return;
    const parent = node.parentNode?.nodeName || "none";
    parentCounts[parent] = (parentCounts[parent] || 0) + 1;
    let ancestor = node.parentNode;
    let inAnchor = false;
    while (ancestor) {
      if (ancestor.nodeName === "a") inAnchor = true;
      ancestor = ancestor.parentNode;
    }
    if (inAnchor) {
      imgsInAnchor += 1;
      if (anchorExamples.length < 4) {
        const anchor = node.parentNode?.nodeName === "a" ? node.parentNode : null;
        anchorExamples.push({
          slug: post.slug,
          parent: parent,
          href: anchor?.attrs?.find((attr) => attr.name === "href")?.value?.slice(0, 120) || null,
          alt: node.attrs?.find((attr) => attr.name === "alt")?.value?.slice(0, 80) || "",
        });
      }
    }
    if (parent !== "figure" && parent !== "a" && outsideFigure.length < 8) {
      outsideFigure.push({ slug: post.slug, parent, alt: node.attrs?.find((a) => a.name === "alt")?.value?.slice(0, 60) || "" });
    }
  });
}

const focus = {};
for (const slug of slugs) {
  const post = data.find((item) => item.slug === slug);
  const fragment = parseFragment(post?.body || "");
  const imgs = [];
  walk(fragment, (node) => {
    if (node.nodeName !== "img") return;
    const src = node.attrs?.find((attr) => attr.name === "src")?.value || "";
    const alt = node.attrs?.find((attr) => attr.name === "alt")?.value ?? null;
    let ancestor = node.parentNode;
    const chain = [];
    while (ancestor && ancestor.nodeName !== "#document-fragment") {
      chain.push(ancestor.nodeName);
      ancestor = ancestor.parentNode;
    }
    imgs.push({
      srcTail: src.split("/").slice(-2).join("/"),
      graphic: src.includes("/graphics/"),
      alt,
      chain,
      pin: Boolean(node.attrs?.find((attr) => attr.name === "data-pin-media")),
    });
  });
  focus[slug] = { count: imgs.length, imgs };
}

await writeFile(
  "scripts/_body-image-structure.json",
  JSON.stringify(
    {
      parentCounts,
      imgsInAnchor,
      figuresWithCaption,
      figuresWithoutCaption,
      captionExamples,
      anchorExamples,
      outsideFigure,
      focus,
    },
    null,
    2
  )
);
console.log(JSON.stringify({ parentCounts, imgsInAnchor, figuresWithCaption, figuresWithoutCaption, anchors: anchorExamples.length }));
