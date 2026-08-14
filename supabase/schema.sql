-- Real Travel Guides — Supabase schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists authors (
  slug text primary key,
  name text not null,
  photo text not null,
  short_bio text not null,
  full_bio text[] not null,
  contact_email text not null
);

create table if not exists books (
  slug text primary key,
  title text not null,
  author_slug text references authors(slug),
  cover text not null,
  tagline text not null,
  description text not null,
  highlights text[] not null,
  amazon_url text not null
);

create table if not exists posts (
  slug text primary key,
  title text not null,
  excerpt text not null,
  cover text not null,
  category text not null,
  read_minutes int not null default 5,
  published_at date not null default current_date,
  body text not null
);

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

-- Row-level security: content tables are public-readable (this is a public
-- website), writes happen only via the Supabase dashboard or service-role
-- key, never from the browser.
alter table authors enable row level security;
alter table books enable row level security;
alter table posts enable row level security;
alter table subscribers enable row level security;

create policy "Public read access" on authors for select using (true);
create policy "Public read access" on books for select using (true);
create policy "Public read access" on posts for select using (true);

-- Subscribers: allow inserts from the anon key (newsletter signup form),
-- but no reads (protects email addresses from being scraped client-side).
create policy "Public insert" on subscribers for insert with check (true);
