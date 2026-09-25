import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

function invalidEmail() {
  return NextResponse.json({ error: "Invalid email" }, { status: 400 });
}

function saveFailed() {
  return NextResponse.json({ error: "Could not subscribe" }, { status: 500 });
}

// Stores signups in Supabase's `subscribers` table. The insert does not read
// the row back: RLS allows anonymous inserts and blocks selects.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidEmail();
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? body.email
      : undefined;

  if (typeof email !== "string") return invalidEmail();

  const trimmed = email.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(trimmed)
  ) {
    return invalidEmail();
  }

  if (!supabase) return saveFailed();

  const { error } = await supabase.from("subscribers").insert({ email: trimmed });

  if (error?.code === "23505") {
    return NextResponse.json({ ok: true, result: "already_subscribed" });
  }

  if (error) return saveFailed();

  return NextResponse.json({ ok: true, result: "subscribed" });
}
