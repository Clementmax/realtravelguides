import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null only when NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is
// missing. Category, author, book, and post queries use seed data solely in
// local development in that case. Production, and any configured query that
// then fails, must throw rather than serve those samples or an empty stand-in.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;
