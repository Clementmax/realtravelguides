/**
 * One-off / repeatable repair: strip Wix nav + publish date + "N min read"
 * that Readability captured at the start of some post bodies.
 *
 *   node scripts/clean-post-chrome.mjs --dry-run
 *   node scripts/clean-post-chrome.mjs
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

const DATE_RE =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}$/i;
const MIN_READ_RE = /^\d+\s+min(?:ute)?s?\s+read$/i;
const UPDATED_RE =
  /^updated:\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}$/i;

function htmlText(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isWixNavList(html) {
  if (/header-navigation/i.test(html)) return true;
  const text = htmlText(html).toLowerCase();
  return (
    text.includes("journeys by rail") &&
    text.includes("switzerland") &&
    text.includes("hidden places")
  );
}

function stripMigratedPostChrome(body) {
  if (!body) return body;
  let html = body.replace(/^\uFEFF/, "").trim();

  const list = html.match(/^<(ul|ol)\b[\s\S]*?<\/\1>/i);
  if (list && isWixNavList(list[0])) {
    html = html.slice(list[0].length).trim();
  }

  while (true) {
    const empty = html.match(/^<(p|div|h[1-6])\b[^>]*>\s*(?:&nbsp;|\s)*<\/\1>/i);
    if (empty) {
      html = html.slice(empty[0].length).trim();
      continue;
    }

    const paragraph = html.match(/^<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!paragraph) break;

    const text = htmlText(paragraph[1]);
    if (
      !text ||
      DATE_RE.test(text) ||
      UPDATED_RE.test(text) ||
      MIN_READ_RE.test(text) ||
      /^search$/i.test(text)
    ) {
      html = html.slice(paragraph[0].length).trim();
      continue;
    }
    break;
  }

  return html;
}

function preview(html) {
  return htmlText(html).slice(0, 140);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from("posts").select("slug,title,body");
  if (error) throw error;

  const changed = [];
  for (const post of data) {
    const next = stripMigratedPostChrome(post.body);
    if (next !== post.body) {
      changed.push({ slug: post.slug, title: post.title, before: preview(post.body), after: preview(next), body: next });
    }
  }

  console.log(`${changed.length} post(s) have leftover nav/date chrome.`);
  for (const row of changed) {
    console.log(`\n- ${row.title}\n  before: ${row.before}\n  after:  ${row.after}`);
  }

  if (DRY_RUN || changed.length === 0) return;

  for (const row of changed) {
    const { error: updateError } = await supabase
      .from("posts")
      .update({ body: row.body })
      .eq("slug", row.slug);
    if (updateError) throw updateError;
  }
  console.log(`\nUpdated ${changed.length} post(s) in Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
