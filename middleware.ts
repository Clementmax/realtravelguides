import { NextRequest, NextResponse } from "next/server";
import { normalizePostSlug } from "@/lib/slug";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/post/")) return NextResponse.next();

  const raw = pathname.slice("/post/".length);
  const canonical = normalizePostSlug(raw);
  if (!canonical || canonical === raw) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/post/${canonical}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: "/post/:path*",
};
