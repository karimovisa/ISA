-- ISA — Weekly Review + Habit Tracker. Run in the Supabase SQL Editor.
-- Weekly cron needs the pg_cron extension enabled.

-- ═══════════ WEEKLY REVIEW ═══════════
create table if not exists public.weekly_reviews (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  week_start_date       date not null,
  goals_completed       int not null default 0,
  journal_entries_count int not null default 0,
  focus_sessions_count  int not null default 0,
  focus_total_minutes   int not null default 0,
  avg_energy_score      numeric,
  most_active_day       date,
  seen_at               timestamptz,
  created_at            timestamptz not null default now(),
  unique (user_id, week_start_date)
);

alter table public.weekly_reviews enable row level security;
drop policy if exists "owner_all" on public.weekly_reviews;
create policy "owner_all" on public.weekly_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.compute_weekly_review(p_user uuid, p_week date)
returns void language plpgsql security definer set search_path = public as $$
declare
  w_end date := p_week + 6;
  v_goals int; v_journal int; v_sessions int; v_minutes int;
  v_energy numeric; v_active date;
begin
  select count(*) into v_goals from goals
    where user_id = p_user and percentage >= 100;
  select count(*) into v_journal from journal_entries
    where user_id = p_user and entry_date between p_week and w_end;
  select count(*), coalesce(round(sum(duration_seconds)/60.0), 0)
    into v_sessions, v_minutes from focus_sessions
    where user_id = p_user and created_at::date between p_week and w_end;
  select round(avg(score), 1) into v_energy from daily_energy_scores
    where user_id = p_user and date between p_week and w_end;
  select created_at::date into v_active from focus_sessions
    where user_id = p_user and created_at::date between p_week and w_end
    group by created_at::date order by sum(duration_seconds) desc limit 1;

  insert into weekly_reviews (user_id, week_start_date, goals_completed,
    journal_entries_count, focus_sessions_count, focus_total_minutes,
    avg_energy_score, most_active_day)
  values (p_user, p_week, coalesce(v_goals,0), coalesce(v_journal,0),
    coalesce(v_sessions,0), coalesce(v_minutes,0), v_energy, v_active)
  on conflict (user_id, week_start_date) do update set
    goals_completed = excluded.goals_completed,
    journal_entries_count = excluded.journal_entries_count,
    focus_sessions_count = excluded.focus_sessions_count,
    focus_total_minutes = excluded.focus_total_minutes,
    avg_energy_score = excluded.avg_energy_score,
    most_active_day = excluded.most_active_day;
end $$;

-- On-demand for the current user (e.g. a "generate" button while testing).
create or replace function public.generate_my_weekly_review(p_week date)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.compute_weekly_review(auth.uid(), p_week);
end $$;
grant execute on function public.generate_my_weekly_review(date) to authenticated;

create or replace function public.generate_all_weekly_reviews()
returns void language plpgsql security definer set search_path = public as $$
declare r record; w date := date_trunc('week', current_date)::date;
begin
  for r in
    select distinct user_id from focus_sessions where created_at::date >= w
    union select distinct user_id from journal_entries where entry_date >= w
    union select distinct user_id from sleep_logs where date >= w
  loop
    perform public.compute_weekly_review(r.user_id, w);
  end loop;
end $$;

-- Sunday 20:00 local (UTC+5) = 15:00 UTC. cron.schedule upserts by job name.
select cron.schedule('weekly-review', '0 15 * * 0', 'select public.generate_all_weekly_reviews()');

-- ═══════════ HABIT TRACKER ═══════════
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  icon       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references public.habits (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  date      date not null,
  completed boolean not null default true,
  unique (habit_id, date)
);

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
drop policy if exists "owner_all" on public.habits;
create policy "owner_all" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on public.habit_logs;
create policy "owner_all" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Consecutive-day streaks (ending today or yesterday) for each active habit.
create or replace function public.get_my_habit_streaks()
returns table (habit_id uuid, streak int)
language plpgsql security definer set search_path = public as $$
declare h record; d date; n int;
begin
  for h in select id from habits where user_id = auth.uid() and is_active loop
    n := 0;
    if exists (select 1 from habit_logs where habit_id = h.id and date = current_date and completed) then
      d := current_date;
    elsif exists (select 1 from habit_logs where habit_id = h.id and date = current_date - 1 and completed) then
      d := current_date - 1;
    else
      habit_id := h.id; streak := 0; return next; continue;
    end if;
    while exists (select 1 from habit_logs where habit_id = h.id and date = d and completed) loop
      n := n + 1; d := d - 1;
    end loop;
    habit_id := h.id; streak := n; return next;
  end loop;
end $$;
grant execute on function public.get_my_habit_streaks() to authenticated;

notify pgrst, 'reload schema';
