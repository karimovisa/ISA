-- ISA — Life Intelligence Engine · Event System (life_events)
-- The normalized, APPEND-ONLY, provenance-bearing record of one person's life.
-- This is the single source of truth the whole AI Engine reads. See
-- docs/ISA_LIFE_INTELLIGENCE_ENGINE.md §5 and src/lib/life-events/.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Additive: no existing table is altered.

create table if not exists public.life_events (
  -- ── Core identity ──
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  event_type       text not null,
  source_module    text not null,
  actor            text not null default 'user'
                   check (actor in ('user','system','recurring')),
  occurred_at      timestamptz not null default now(), -- when it happened in the life
  created_at       timestamptz not null default now(), -- when ISA recorded it

  -- ── Meaning ──
  category         text not null default '',
  importance       text not null default 'trivial'
                   check (importance in ('trivial','notable','significant','pivotal')),
  magnitude        real not null default 0
                   check (magnitude >= 0 and magnitude <= 1),
  valence          text not null default 'neutral'
                   check (valence in ('positive','neutral','negative','ambiguous')),
  emotional_impact real
                   check (emotional_impact is null
                          or (emotional_impact >= -1 and emotional_impact <= 1)),

  -- ── Relationships (the graph) ──
  links            jsonb not null default '{}'::jsonb,

  -- ── Context ──
  payload          jsonb not null default '{}'::jsonb,
  metadata         jsonb not null default '{}'::jsonb,
  provenance       text  not null default 'manual entry',

  -- ── Future intelligence signals (carried, not yet consumed) ──
  intelligence     jsonb not null default '{}'::jsonb,

  -- ── Explainability ──
  reasons          jsonb not null default '[]'::jsonb
);

-- Read patterns the Engine actually uses.
create index if not exists life_events_user_time    on public.life_events (user_id, occurred_at desc);
create index if not exists life_events_user_module  on public.life_events (user_id, source_module);
create index if not exists life_events_user_type    on public.life_events (user_id, event_type);
create index if not exists life_events_user_import  on public.life_events (user_id, importance);

-- ── Row Level Security ──
alter table public.life_events enable row level security;

-- APPEND-ONLY BY DESIGN: owner may SELECT, INSERT, and DELETE — but there is
-- deliberately NO UPDATE policy, so recorded history cannot be edited
-- (corrections are new events, LIE §5.1). DELETE is kept so the user retains
-- full ownership and right-to-erase (Privacy Is Sacred).
drop policy if exists "life_events_select" on public.life_events;
drop policy if exists "life_events_insert" on public.life_events;
drop policy if exists "life_events_delete" on public.life_events;

create policy "life_events_select" on public.life_events
  for select using (auth.uid() = user_id);
create policy "life_events_insert" on public.life_events
  for insert with check (auth.uid() = user_id);
create policy "life_events_delete" on public.life_events
  for delete using (auth.uid() = user_id);

-- LLM-forward note (do NOT run now): when we add NL search / narrative later,
-- it is purely additive and needs no refactor —
--   create extension if not exists vector;
--   alter table public.life_events add column embedding vector(1536);
-- plus a separate read-only consumer. Intentionally omitted from V1.

notify pgrst, 'reload schema';
