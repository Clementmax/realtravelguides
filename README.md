# Real Travel Guides

Rebuild of realtravelguides.com — Next.js (App Router) + Supabase + Vercel.

## URL structure (matches the live Wix site exactly — no redirects needed)

- `/` — home
- `/books` — all 4 books
- `/elenarossetti`, `/sophiepicot` — author pages
- `/journeysbyrail` — blog index
- `/journeysbyrail/categories/{switzerland,france,italy,spain,food,culture,scenicroutes,hiddenplaces}`
- `/post/{slug}` — individual blog posts

## Stack

- **Next.js** (App Router, TypeScript, Tailwind v4) — hosted on Vercel
- **Supabase** — content (books, authors, posts) and newsletter subscribers
- Content falls back to `lib/seed-data/*` if Supabase isn't configured yet, so the site works immediately in preview and switches over to Supabase automatically once it's connected — see `lib/queries.ts`.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key once you have a project
npm run dev
```

## Deploying

1. Push this repo to GitHub (see below).
2. In Vercel: New Project → import the GitHub repo → deploy. No config needed beyond the env vars below.
3. Add environment variables in Vercel (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Point your domain (`realtravelguides.com`) at the Vercel project (Vercel → Domains), then update DNS at your registrar. Do this last, once you've reviewed the preview deployment.

## Pushing this to your GitHub repo

From this project folder:

```bash
git init
git add .
git commit -m "Initial rebuild of realtravelguides.com"
git branch -M main
git remote add origin https://github.com/<your-username>/realtravelguides.git
git push -u origin main
```

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Run `supabase/seed.sql` to populate books, authors, and post metadata (matches the fallback data already in the site).
4. See `MIGRATION.md` for images and full blog post content.

## What still needs your input before launch

- **Images** — book covers, author photos, and post images need to be downloaded from the Wix site and added to `public/images/...` (or uploaded to Supabase Storage). See `MIGRATION.md`.
- **Blog post bodies** — only metadata (title, category, excerpt) has been migrated for the 6 known posts. Full body text needs pasting in from the Wix editor. If there are more than 6 posts, those need adding too.
- **Newsletter service** — signups currently save to a `subscribers` table in Supabase. If you want actual email sending/campaigns, connect a service like Buttondown and I'll wire it in.
