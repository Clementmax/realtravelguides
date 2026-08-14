import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Stores signups in Supabase's `subscribers` table for now. If/when you pick
// a newsletter service (e.g. Buttondown), swap the body of this function for
// a call to that service's API instead.
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!supabase) {
    // Supabase not configured yet — accept the request so the UI still
    // works in early preview, but nothing is persisted.
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { error } = await supabase
    .from("subscribers")
    .insert({ email })
    .select()
    .single();

  // Ignore unique-constraint errors (already subscribed) — treat as success.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Could not subscribe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
