import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// During early setup (or local dev without env vars) this stays null and
// every query function in lib/queries.ts falls back to the seed data in
// lib/seed-data.ts, so the site always renders. Once NEXT_PUBLIC_SUPABASE_URL
// and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel / .env.local, Supabase
// becomes the live source of truth automatically.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;
