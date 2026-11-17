import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { parseFragment } from "parse5";

dotenv.config({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { data, error } = await supabase.from("posts").select("slug, body");
if (error) throw new Error(error.message);

function textFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromTree(node) {
  if (node.nodeName === "#text") return node.value;
  if (!node.childNodes) return "";
  return node.childNodes.map(textFromTree).join("");
}

let mismatches = 0;
const samples = [];
for (const post of data) {
  const html = post.body || "";
  const tree = textFromTree(parseFragment(html)).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const raw = textFromHtml(html);
  if (tree !== raw) {
    mismatches += 1;
    if (samples.length < 5) {
      let index = 0;
      while (index < tree.length && index < raw.length && tree[index] === raw[index]) index += 1;
      samples.push({
        slug: post.slug,
        at: index,
        tree: tree.slice(Math.max(0, index - 40), index + 40),
        raw: raw.slice(Math.max(0, index - 40), index + 40),
      });
    }
  }
}
console.log(JSON.stringify({ posts: data.length, mismatches, samples }, null, 2));
