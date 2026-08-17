# Content migration checklist

## 1. Images

Download each image from Wix (right-click → save, or use the URLs already
referenced in the old site) and save at these paths, replacing the
placeholders referenced in the seed data:

| File | Source (Wix) |
|---|---|
| `public/images/hero.jpg` | Homepage hero image |
| `public/images/books/touring-italy-by-train.jpg` | Books page, Italy cover |
| `public/images/books/touring-switzerland-by-train.jpg` | Books page, Switzerland cover |
| `public/images/books/touring-spain-by-train.jpg` | Books page, Spain cover |
| `public/images/books/touring-france-by-train.jpg` | Books page, France cover |
| `public/images/authors/elena-rossetti.jpg` | Elena's author photo |
| `public/images/authors/sophie-picot.jpg` | Sophie's author photo |
| `public/images/posts/*.jpg` | One per blog post, matching the `cover` field in `lib/seed-data/posts.ts` |

Once added, either commit them to the repo (simplest, fine at this size) or
upload to Supabase Storage and update the `cover`/`photo` URLs in the
`books`/`authors`/`posts` tables to the Storage URLs instead.

## 2. Blog posts (all ~186 of them, automated)

Manually copying 186 posts isn't realistic, so there's a script that does it
for you: `scripts/migrate-posts.mjs`. It:

1. Reads `https://www.realtravelguides.com/blog-feed.xml` for metadata
   (title, slug, categories, date, cover image, excerpt).
2. Fetches each post's live page and extracts the full article body using
   Readability (Firefox's Reader Mode engine) — this works regardless of
   Wix's exact page markup.
3. Downloads each cover image into `public/images/posts/`.
4. Upserts everything into Supabase's `posts` table.

**Run it:**

```bash
npm install    # picks up fast-xml-parser, jsdom, @mozilla/readability
```

Get your Supabase **service role key** (Project Settings → API → service_role
secret — not the anon key, since this writes to the DB directly). Then test
on a handful of posts first:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/migrate-posts.mjs --limit=5 --dry-run
```

This prints what it *would* insert without touching Supabase or downloading
images — check that titles, categories, and body text look right. Once
you're happy:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/migrate-posts.mjs
```

It logs progress post-by-post and prints a summary of any that failed at the
end (network hiccups, a page that doesn't parse cleanly, etc.) — safe to
re-run, since it upserts by slug.

**One thing to spot-check afterward:** the script maps Wix's category labels
("Scenic Routes", "Hidden Gems", etc.) to our category slugs via a lookup
table in the script. If a post's Wix category doesn't match anything in that
table, it falls back to "Hidden Places" — worth a quick look through
Supabase after the run to make sure nothing landed in the wrong bucket.

## 3. Fix the mis-linked book covers (bug on the old site)

On the current Wix site, the Switzerland and Spain book cover *images* on
`/books` link to the Italy Amazon page by mistake (only the "Buy on Amazon"
buttons are correct). This rebuild fixes that automatically — every cover
and button links to the right book — so no action needed here, just noting
it's intentionally different from the old site.
