/**
 * List existing place tags and confirm the new slug is free.
 * Prints no credentials.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const SLUG = "munich-to-milan-and-rome-by-frecciarossa";

const { data: cats, error: catError } = await supabase.from("categories").select("slug,label").order("slug");
if (catError) throw catError;
console.log("CATEGORIES:");
for (const cat of cats || []) console.log(`  ${cat.slug} | ${cat.label}`);

const { data: existing, error: existingError } = await supabase
  .from("posts")
  .select("slug")
  .eq("slug", SLUG)
  .maybeSingle();
if (existingError) throw existingError;
console.log(`SLUG_EXISTS: ${Boolean(existing)}`);

const { data: placeRows, error: placeError } = await supabase.from("posts").select("places");
if (placeError) throw placeError;
const known = new Set();
for (const row of placeRows || []) {
  for (const place of row.places || []) known.add(place);
}
const sorted = [...known].sort();
console.log(`PLACE_COUNT: ${sorted.length}`);
for (const place of sorted) console.log(`  ${place}`);

const watch = [
  "munich",
  "milan",
  "rome",
  "verona",
  "florence",
  "bologna",
  "bolzano",
  "bozen",
  "innsbruck",
  "trento",
  "rovereto",
  "brescia",
  "como",
  "lake-como",
  "bergamo",
  "dolomites",
  "south-tyrol",
  "brenner",
  "tuscany",
  "lombardy",
  "emilia-romagna",
  "venice",
  "naples",
  "amalfi",
  "amalfi-coast",
  "germany",
  "austria",
  "bavaria",
  "tyrol",
];
console.log("WATCH:");
for (const tag of watch) console.log(`  ${tag}: ${known.has(tag)}`);

const { data: sample, error: sampleError } = await supabase
  .from("posts")
  .select("body,published_at,images,cover")
  .eq("slug", "brussels-to-milan-by-night-train")
  .single();
if (sampleError) throw sampleError;
const body = sample.body || "";
const figure = body.match(/<figure>[\s\S]*?<\/figure>/);
console.log("BRUSSELS_PUBLISHED:", sample.published_at);
console.log("BRUSSELS_IMAGES:", JSON.stringify(sample.images));
console.log("BRUSSELS_COVER:", sample.cover);
console.log("BRUSSELS_BODY_START:");
console.log(body.slice(0, 600));
console.log("BRUSSELS_FIGURE:");
console.log(figure ? figure[0] : "NONE");
console.log("BRUSSELS_HAS_FIGCAPTION:", body.includes("<figcaption>"));
console.log("BRUSSELS_HAS_EM:", body.includes("<em>"));
