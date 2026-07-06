-- ISA — Namoz vaqtlari (Prayer times). Run in the Supabase SQL Editor.
-- Uses pg_cron + pg_net (already enabled for reminders).

-- ── Preferences (one row per user) ─────────────────────────────
create table if not exists public.prayer_preferences (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  wants_to_pray         boolean,                 -- null = not asked yet
  notifications_enabled boolean not null default false,
  activated             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Daily times per city (written by the sync job via service role) ──
create table if not exists public.prayer_times (
  id     uuid primary key default gen_random_uuid(),
  city   text not null default 'sirdaryo',
  date   date not null,
  bomdod time not null,
  quyosh time not null,
  peshin time not null,
  asr    time not null,
  shom   time not null,
  xufton time not null,
  unique (city, date)
);
create index if not exists prayer_times_city_date_idx on public.prayer_times (city, date);

-- ── Per-prayer tick log ────────────────────────────────────────
create table if not exists public.prayer_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  prayer_name text not null check (prayer_name in ('bomdod','peshin','asr','shom','xufton')),
  ticked_at   timestamptz,
  status      text not null check (status in ('vaqtida','kechikkan','qazo')),
  unique (user_id, date, prayer_name)
);
create index if not exists prayer_logs_user_date_idx on public.prayer_logs (user_id, date);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.prayer_preferences enable row level security;
alter table public.prayer_logs        enable row level security;
alter table public.prayer_times        enable row level security;

drop policy if exists "owner_all" on public.prayer_preferences;
create policy "owner_all" on public.prayer_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on public.prayer_logs;
create policy "owner_all" on public.prayer_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Times are shared reference data: any signed-in user may read; writes go
-- through the service role (sync job), which bypasses RLS.
drop policy if exists "read_all" on public.prayer_times;
create policy "read_all" on public.prayer_times
  for select using (auth.role() = 'authenticated');

-- ── Daily sync (00:05 local = 19:05 UTC): scrape + Aladhan fallback ──
select cron.schedule(
  'prayer-sync',
  '5 19 * * *',
  $$
  select net.http_get(
    url     := 'https://islom-os.vercel.app/api/prayer/sync',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  )
  $$
);

notify pgrst, 'reload schema';
