import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null only when NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is
// missing. Post queries use the seed articles solely in local development in
// that case. Production, and any configured query that then fails, must throw
// rather than serve those samples. Categories, authors, and books still fall
// back to their seed data when this client is null or the query fails.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;
