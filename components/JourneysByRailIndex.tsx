"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { CategoryRecord, Post } from "@/lib/types";
import { foldForSearch } from "@/lib/slug";

type JourneyListing = Pick<
  Post,
  "slug" | "title" | "excerpt" | "cover" | "categories" | "read_minutes"
>;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function JourneysByRailIndex({
  posts,
  categories,
  categoryLabels,
}: {
  posts: JourneyListing[];
  categories: CategoryRecord[];
  categoryLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");

  const haystacks = useMemo(
    () =>
      posts.map((post) =>
        foldForSearch(
          [
            post.title,
            post.excerpt,
            post.slug,
            ...post.categories.map((c) => categoryLabels[c] ?? c),
          ].join(" ")
        )
      ),
    [posts, categoryLabels]
  );

  const tokens = foldForSearch(query).split(/\s+/).filter(Boolean);
  const filtered =
    tokens.length === 0
      ? posts
      : posts.filter((_, index) => tokens.every((token) => haystacks[index].includes(token)));

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mt-8"
      >
        <label htmlFor="journey-search" className="sr-only">
          Search journeys
        </label>
        <div className="relative max-w-xl">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
            <SearchIcon />
          </span>
          <input
            id="journey-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search journeys — try Cadiz, Nimes, or truffle"
            autoComplete="off"
            className="w-full rounded-md border border-border-line bg-paper-raised py-2.5 pl-10 pr-10 text-sm text-pine placeholder:text-stone-light focus:outline-none focus:ring-2 focus:ring-moss"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-2 px-2 text-xs text-stone hover:text-pine"
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/journeysbyrail/categories/${c.slug}`}
            className="rounded-full border border-border-line px-3 py-1 text-xs text-stone transition-colors hover:border-moss hover:text-moss"
          >
            {c.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-12 text-sm text-stone">
          No journeys match “{query.trim()}”. Try a city, region, or theme.
        </p>
      ) : (
        <>
          {tokens.length > 0 ? (
            <p className="mt-8 text-xs text-stone">
              {filtered.length} {filtered.length === 1 ? "journey" : "journeys"} found
            </p>
          ) : null}
          <div className={`grid gap-10 sm:grid-cols-2 md:grid-cols-3 ${tokens.length > 0 ? "mt-4" : "mt-12"}`}>
            {filtered.map((post) => (
              <PostCard
                key={post.slug}
                post={post}
                categoryLabel={categoryLabels[post.categories[0]]}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
