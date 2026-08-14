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

## 2. Blog post bodies

For each of the 6 posts in `lib/seed-data/posts.ts` / `supabase/seed.sql`:

1. Open the post in the Wix editor.
2. Copy the full body text.
3. Paste it into the `body` field, either directly in `supabase/seed.sql`
   before running it, or later via the Supabase Table Editor on the `posts`
   table.

## 3. Confirm there aren't more posts

Only 6 posts were visible on `/journeysbyrail` at the time of this rebuild.
If Wix has more (older posts, paginated), list their titles/slugs/categories
and I'll add them the same way — or check the Wix dashboard's post count
directly, which is the fastest way to confirm.

## 4. Fix the mis-linked book covers (bug on the old site)

On the current Wix site, the Switzerland and Spain book cover *images* on
`/books` link to the Italy Amazon page by mistake (only the "Buy on Amazon"
buttons are correct). This rebuild fixes that automatically — every cover
and button links to the right book — so no action needed here, just noting
it's intentionally different from the old site.
