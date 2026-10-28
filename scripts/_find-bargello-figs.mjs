import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("missing env");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from("posts")
  .select("body")
  .eq("slug", "48-hours-in-florence-this-autumn")
  .maybeSingle();

if (error) {
  console.error(error.message);
  process.exit(1);
}
if (!data?.body) {
  console.error("no post body");
  process.exit(1);
}

const body = data.body;
const lower = body.toLowerCase();
const needle = "finest collections of renaissance sculptures";
let idx = lower.indexOf(needle);
console.log("needleIdx", idx, "bodyLen", body.length);
if (idx < 0) {
  const m = lower.match(/renaissance sculpt/);
  console.log("fallback", m && m.index);
  idx = m ? m.index : 0;
}

const slice = body.slice(Math.max(0, idx - 500), idx + 8000);
const figs = [...slice.matchAll(/<figure[\s\S]*?<\/figure>/gi)];
console.log("FIGURE_COUNT", figs.length);
for (const f of figs) {
  const html = f[0];
  const src = html.match(/src="([^"]+)"/);
  const alt = html.match(/alt="([^"]*)"/);
  console.log("---SRC", src && src[1]);
  console.log("ALT", alt && alt[1]);
  console.log("HAS_ROTATE", /rotate|transform/i.test(html));
  console.log("SNIP", html.slice(0, 400).replace(/\s+/g, " "));
}

const text = body
  .slice(Math.max(0, idx - 120), idx + 2200)
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");
console.log("CONTEXT_TEXT");
console.log(text.slice(0, 1600));
