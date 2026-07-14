-- ISA — Memory Engine (Subsystem #3)
-- Deterministic, append-only-derived long-term memory built FROM life_events.
-- Three projection tables + a rebuild processor on pg_cron. Additive; no
-- existing table is touched. Read through src/lib/memory (never query direct).

-- ─────────────────────────── TABLES ───────────────────────────

-- Consolidated, subject-centric memory. Repeated events about the same subject
-- (a goal, a habit, a behavior) evolve ONE row — not N rows.
create table if not exists public.ai_memory (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  memory_type      text not null,          -- goal|project|habit|finance_goal|behavior|milestone|preference|…
  subject_key      text not null,          -- stable key within the type (entity id or 'module:category')
  title            text not null default '',
  summary          text not null default '',
  importance       text not null default 'low'
                   check (importance in ('critical','high','medium','low','temporary')),
  importance_score real not null default 0 check (importance_score >= 0 and importance_score <= 1),
  status           text not null default 'active'
                   check (status in ('active','archived','permanent')),
  tags             jsonb not null default '[]'::jsonb,
  occurrence_count int  not null default 0,
  magnitude_avg    real not null default 0,
  first_event_at   timestamptz,
  last_event_at    timestamptz,
  source_module    text not null default '',
  links            jsonb not null default '{}'::jsonb,
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, memory_type, subject_key)
);

-- Knowledge-graph edges between memories (many-to-many).
create table if not exists public.memory_relationships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  from_memory uuid not null references public.ai_memory (id) on delete cascade,
  to_memory   uuid not null references public.ai_memory (id) on delete cascade,
  rel_type    text not null default 'co_active',
  weight      real not null default 1,
  created_at  timestamptz not null default now(),
  unique (user_id, from_memory, to_memory, rel_type)
);

-- Chronological Life Timeline of pivotal moments.
create table if not exists public.life_timeline (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null,
  occurred_at timestamptz not null,
  title       text not null default '',
  category    text not null default 'milestone',
  importance  text not null default 'critical',
  memory_id   uuid references public.ai_memory (id) on delete set null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists ai_memory_user_type    on public.ai_memory (user_id, memory_type);
create index if not exists ai_memory_user_import  on public.ai_memory (user_id, importance_score desc);
create index if not exists ai_memory_user_updated on public.ai_memory (user_id, updated_at desc);
create index if not exists ai_memory_tags_gin     on public.ai_memory using gin (tags);
create index if not exists ai_memory_links_gin    on public.ai_memory using gin (links);
create index if not exists mem_rel_user_from      on public.memory_relationships (user_id, from_memory);
create index if not exists mem_rel_user_to        on public.memory_relationships (user_id, to_memory);
create index if not exists life_timeline_user_time on public.life_timeline (user_id, occurred_at desc);

-- ─────────────────────────── RLS ───────────────────────────
do $$ declare t text; begin
  foreach t in array array['ai_memory','memory_relationships','life_timeline'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on public.%I;', t);
    execute format('create policy "owner_all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ─────────────────────── SCORING HELPERS ───────────────────────
create or replace function public.mem_imp_score(imp text) returns real language sql immutable as $$
  select case imp when 'pivotal' then 1.0 when 'significant' then 0.75
                  when 'notable' then 0.5 when 'trivial' then 0.25 else 0.1 end::real;
$$;

create or replace function public.mem_tier(score real) returns text language sql immutable as $$
  select case when score >= 1 then 'critical' when score >= 0.7 then 'high'
              when score >= 0.4 then 'medium' when score >= 0.2 then 'low' else 'temporary' end;
$$;

create or replace function public.mem_tags(module text) returns jsonb language sql immutable as $$
  select case module
    when 'money'    then '["finance"]'::jsonb
    when 'goals'    then '["productivity","goals"]'::jsonb
    when 'projects' then '["productivity","career"]'::jsonb
    when 'focus'    then '["productivity"]'::jsonb
    when 'habits'   then '["personal","productivity"]'::jsonb
    when 'health'   then '["health"]'::jsonb
    when 'energy'   then '["health","personal"]'::jsonb
    when 'prayer'   then '["faith","personal"]'::jsonb
    when 'journal'  then '["personal"]'::jsonb
    when 'ideas'    then '["ideas"]'::jsonb
    when 'tasks'    then '["productivity"]'::jsonb
    else '["personal"]'::jsonb end;
$$;

-- ─────────────────────── THE MEMORY PROCESSOR ───────────────────────
-- Idempotent: recomputes a user's memory from their life_events. Consolidation
-- is intrinsic — GROUP BY subject collapses many events into one evolving row.
create or replace function public.rebuild_memory_for(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 1) ENTITY MEMORIES (goal / habit / finance_goal / project)
  with ev as (
    select id, event_type, source_module, category, importance, magnitude, occurred_at, payload, links
    from life_events where user_id = p_user
  ),
  entity as (
    select 'goal'::text mtype, jsonb_array_elements_text(links->'goalIds') skey,
           coalesce(payload->>'title','Goal') sname, 'goals'::text modu,
           importance, magnitude, occurred_at, event_type
    from ev where links ? 'goalIds'
    union all
    select 'habit', jsonb_array_elements_text(links->'habitIds'),
           coalesce(payload->>'habit','Habit'), 'habits', importance, magnitude, occurred_at, event_type
    from ev where links ? 'habitIds'
    union all
    select 'finance_goal', jsonb_array_elements_text(links->'financeGoalIds'),
           coalesce(payload->>'name','Savings goal'), 'money', importance, magnitude, occurred_at, event_type
    from ev where links ? 'financeGoalIds'
    union all
    select 'project', jsonb_array_elements_text(links->'taskIds'),
           coalesce(payload->>'title','Project'), 'projects', importance, magnitude, occurred_at, event_type
    from ev where links ? 'taskIds'
  )
  insert into ai_memory (user_id, memory_type, subject_key, title, summary, importance,
    importance_score, status, tags, occurrence_count, magnitude_avg, first_event_at,
    last_event_at, source_module, links, data, updated_at)
  select p_user, mtype, skey,
    (array_agg(sname order by occurred_at desc))[1],
    format('%s tracked across %s event(s)', mtype, count(*)),
    mem_tier(max(mem_imp_score(importance))), max(mem_imp_score(importance)),
    case when mem_tier(max(mem_imp_score(importance))) = 'critical' then 'permanent' else 'active' end,
    mem_tags(modu), count(*), round(avg(magnitude)::numeric, 3),
    min(occurred_at), max(occurred_at), modu,
    jsonb_build_object(mtype || 'Id', skey),
    jsonb_build_object('lastEvent', (array_agg(event_type order by occurred_at desc))[1]),
    now()
  from entity group by mtype, skey, modu
  on conflict (user_id, memory_type, subject_key) do update set
    title = excluded.title, summary = excluded.summary, importance = excluded.importance,
    importance_score = excluded.importance_score,
    status = case when ai_memory.status = 'archived' then 'archived' else excluded.status end,
    tags = excluded.tags, occurrence_count = excluded.occurrence_count,
    magnitude_avg = excluded.magnitude_avg,
    first_event_at = least(ai_memory.first_event_at, excluded.first_event_at),
    last_event_at = greatest(ai_memory.last_event_at, excluded.last_event_at),
    links = excluded.links, data = excluded.data, updated_at = now();

  -- 2) BEHAVIOR MEMORIES (one evolving memory per module:category)
  insert into ai_memory (user_id, memory_type, subject_key, title, summary, importance,
    importance_score, status, tags, occurrence_count, magnitude_avg, first_event_at,
    last_event_at, source_module, links, data, updated_at)
  select p_user, 'behavior', source_module || ':' || category,
    initcap(source_module) || ' · ' || category,
    format('%s event(s); avg intensity %s', count(*), round(avg(magnitude)::numeric, 2)),
    mem_tier(least(0.75, max(mem_imp_score(importance)))::real),
    least(0.75, max(mem_imp_score(importance)))::real,
    'active', mem_tags(source_module), count(*), round(avg(magnitude)::numeric, 3),
    min(occurred_at), max(occurred_at), source_module, '{}'::jsonb,
    jsonb_build_object('lastEvent', (array_agg(event_type order by occurred_at desc))[1]),
    now()
  from life_events where user_id = p_user
  group by source_module, category
  on conflict (user_id, memory_type, subject_key) do update set
    title = excluded.title, summary = excluded.summary, importance = excluded.importance,
    importance_score = excluded.importance_score,
    status = case when ai_memory.status = 'archived' then 'archived' else 'active' end,
    tags = excluded.tags, occurrence_count = excluded.occurrence_count,
    magnitude_avg = excluded.magnitude_avg,
    first_event_at = least(ai_memory.first_event_at, excluded.first_event_at),
    last_event_at = greatest(ai_memory.last_event_at, excluded.last_event_at),
    data = excluded.data, updated_at = now();

  -- 3) MILESTONE MEMORIES + LIFE TIMELINE (pivotal events become permanent)
  insert into ai_memory (user_id, memory_type, subject_key, title, summary, importance,
    importance_score, status, tags, occurrence_count, magnitude_avg, first_event_at,
    last_event_at, source_module, links, data, updated_at)
  select p_user, 'milestone', id::text,
    coalesce(payload->>'title', payload->>'name', payload->>'habit', event_type),
    format('%s — a pivotal moment', event_type),
    'critical', 1.0, 'permanent', mem_tags(source_module), 1, magnitude,
    occurred_at, occurred_at, source_module, links, payload, now()
  from life_events where user_id = p_user and importance = 'pivotal'
  on conflict (user_id, memory_type, subject_key) do nothing;

  insert into life_timeline (user_id, event_id, occurred_at, title, category, importance, data)
  select p_user, id, occurred_at,
    coalesce(payload->>'title', payload->>'name', payload->>'habit', event_type),
    case source_module when 'money' then 'financial' when 'health' then 'running'
                       when 'goals' then 'achievement' when 'projects' then 'achievement'
                       when 'focus' then 'learning' else 'milestone' end,
    'critical', payload
  from life_events where user_id = p_user and importance = 'pivotal'
  on conflict (user_id, event_id) do nothing;

  -- 4) KNOWLEDGE GRAPH — co-activity edges between behavior memories.
  -- Weight = number of local days on which both areas were active (honest
  -- co-occurrence, never claimed as causation).
  with day_subj as (
    select distinct (metadata->'timeContext'->>'localDate') d, source_module || ':' || category subj
    from life_events
    where user_id = p_user and metadata->'timeContext'->>'localDate' is not null
  ),
  pairs as (
    select x.subj a_subj, y.subj b_subj, count(*)::real w
    from day_subj x join day_subj y on x.d = y.d and x.subj < y.subj
    group by x.subj, y.subj
  )
  insert into memory_relationships (user_id, from_memory, to_memory, rel_type, weight)
  select p_user, a.id, b.id, 'co_active', p.w
  from pairs p
  join ai_memory a on a.user_id = p_user and a.memory_type = 'behavior' and a.subject_key = p.a_subj
  join ai_memory b on b.user_id = p_user and b.memory_type = 'behavior' and b.subject_key = p.b_subj
  on conflict (user_id, from_memory, to_memory, rel_type) do update set weight = excluded.weight;
end $$;

-- On-demand rebuild for the signed-in user (called by the TS API).
create or replace function public.process_my_memory()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.rebuild_memory_for(auth.uid());
end $$;

-- Nightly rebuild for everyone with events.
create or replace function public.rebuild_all_memory()
returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select distinct user_id from life_events loop
    perform public.rebuild_memory_for(u);
  end loop;
end $$;

-- 02:15 UTC nightly. cron.schedule upserts by job name.
select cron.schedule('memory-rebuild', '15 2 * * *', 'select public.rebuild_all_memory()');

notify pgrst, 'reload schema';
