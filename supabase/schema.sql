-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query).
-- It creates a single shared key/value table that the whole app reads and writes to,
-- so everyone using the site sees the same live data.

create table if not exists public.eo_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable realtime so changes made by one person show up for everyone else automatically.
alter publication supabase_realtime add table public.eo_kv;

-- Row Level Security: on by default in Supabase. The policies below allow
-- anyone with your site's public (anon) key to read and write this table.
-- That's the simplest setup for a small trusted team with no login screen.
-- If you later want to require sign-in, see the "Adding a login" section in README.md.
alter table public.eo_kv enable row level security;

create policy "anyone can read eo_kv"
  on public.eo_kv for select
  to anon
  using (true);

create policy "anyone can write eo_kv"
  on public.eo_kv for insert
  to anon
  with check (true);

create policy "anyone can update eo_kv"
  on public.eo_kv for update
  to anon
  using (true)
  with check (true);
