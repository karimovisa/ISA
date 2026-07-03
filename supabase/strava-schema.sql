-- ISA × Strava — run this in the Supabase SQL Editor.
-- Stores each user's Strava connection + imported run activities.

-- OAuth handshake nonces (short-lived, links a Strava redirect back to a user).
create table if not exists public.strava_oauth_states (
  nonce      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One Strava connection per user (tokens written by the server / service role).
create table if not exists public.strava_connections (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  athlete_id    bigint,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  last_sync     timestamptz,
  created_at    timestamptz not null default now()
);

-- Imported run activities.
create table if not exists public.strava_activities (
  id               bigint primary key,          -- Strava activity id
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text,
  distance_m       numeric not null default 0,
  moving_time_s    int not null default 0,
  elapsed_time_s   int not null default 0,
  total_elevation  numeric not null default 0,
  average_speed    numeric not null default 0,  -- m/s
  start_date       timestamptz not null,
  created_at       timestamptz not null default now()
);

create index if not exists strava_activities_user_date_idx
  on public.strava_activities (user_id, start_date desc);

-- ---------- RLS ----------
alter table public.strava_oauth_states enable row level security;
alter table public.strava_connections enable row level security;
alter table public.strava_activities enable row level security;

drop policy if exists "owner_all" on public.strava_oauth_states;
create policy "owner_all" on public.strava_oauth_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users can read their own connection + activities; the server (service role)
-- bypasses RLS to write tokens and imported activities.
drop policy if exists "owner_read" on public.strava_connections;
create policy "owner_read" on public.strava_connections
  for select using (auth.uid() = user_id);
drop policy if exists "owner_delete" on public.strava_connections;
create policy "owner_delete" on public.strava_connections
  for delete using (auth.uid() = user_id);

drop policy if exists "owner_read" on public.strava_activities;
create policy "owner_read" on public.strava_activities
  for select using (auth.uid() = user_id);
