-- ISLOM OS — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- It creates the tables and Row Level Security so each user only sees their own data.

-- ---------- GOALS ----------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  percentage  int  not null default 0 check (percentage between 0 and 100),
  deadline    date,
  motivation  text,
  created_at  timestamptz not null default now()
);

-- ---------- PROJECTS ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  status      text not null default 'planning'
              check (status in ('planning','active','paused','done')),
  percentage  int  not null default 0 check (percentage between 0 and 100),
  tasks_total int  not null default 0,
  tasks_done  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- PROJECT TASKS ----------
create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- IDEAS ----------
create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  content     text not null,
  tag         text,
  created_at  timestamptz not null default now()
);

-- ---------- JOURNAL ----------
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,
  did_today   text,
  learned     text,
  tomorrow    text,
  created_at  timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- ---------- FOCUS SESSIONS ----------
create table if not exists public.focus_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  label            text not null,
  duration_seconds int  not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------- RUNS ----------
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  log_date    date not null,
  distance_km numeric not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
do $$
declare t text;
begin
  foreach t in array array[
    'goals','projects','project_tasks','ideas','journal_entries','focus_sessions','runs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on public.%I;', t);
    execute format(
      'create policy "owner_all" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);', t);
  end loop;
end $$;
