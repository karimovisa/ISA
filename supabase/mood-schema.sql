-- ISA — Mood tracking + Calendar. Run in the Supabase SQL Editor.

create table if not exists public.mood_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  mood_score int not null check (mood_score between 1 and 5),
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.mood_logs enable row level security;
drop policy if exists "owner_all" on public.mood_logs;
create policy "owner_all" on public.mood_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weekly review gains an average mood column.
alter table public.weekly_reviews add column if not exists avg_mood_score numeric;

create or replace function public.compute_weekly_review(p_user uuid, p_week date)
returns void language plpgsql security definer set search_path = public as $$
declare
  w_end date := p_week + 6;
  v_goals int; v_journal int; v_sessions int; v_minutes int;
  v_energy numeric; v_active date; v_mood numeric;
begin
  select count(*) into v_goals from goals where user_id = p_user and percentage >= 100;
  select count(*) into v_journal from journal_entries
    where user_id = p_user and entry_date between p_week and w_end;
  select count(*), coalesce(round(sum(duration_seconds)/60.0), 0)
    into v_sessions, v_minutes from focus_sessions
    where user_id = p_user and created_at::date between p_week and w_end;
  select round(avg(score), 1) into v_energy from daily_energy_scores
    where user_id = p_user and date between p_week and w_end;
  select round(avg(mood_score), 1) into v_mood from mood_logs
    where user_id = p_user and date between p_week and w_end;
  select created_at::date into v_active from focus_sessions
    where user_id = p_user and created_at::date between p_week and w_end
    group by created_at::date order by sum(duration_seconds) desc limit 1;

  insert into weekly_reviews (user_id, week_start_date, goals_completed,
    journal_entries_count, focus_sessions_count, focus_total_minutes,
    avg_energy_score, most_active_day, avg_mood_score)
  values (p_user, p_week, coalesce(v_goals,0), coalesce(v_journal,0),
    coalesce(v_sessions,0), coalesce(v_minutes,0), v_energy, v_active, v_mood)
  on conflict (user_id, week_start_date) do update set
    goals_completed = excluded.goals_completed,
    journal_entries_count = excluded.journal_entries_count,
    focus_sessions_count = excluded.focus_sessions_count,
    focus_total_minutes = excluded.focus_total_minutes,
    avg_energy_score = excluded.avg_energy_score,
    most_active_day = excluded.most_active_day,
    avg_mood_score = excluded.avg_mood_score;
end $$;

-- One call returns the whole month: mood per day + whether a journal exists.
create or replace function public.get_month_moods(p_start date, p_end date)
returns table (d date, mood_score int, has_journal boolean)
language sql security definer set search_path = public as $$
  select dd::date,
    (select m.mood_score from mood_logs m
       where m.user_id = auth.uid() and m.date = dd::date limit 1),
    exists (select 1 from journal_entries j
       where j.user_id = auth.uid() and j.entry_date = dd::date)
  from generate_series(p_start, p_end, interval '1 day') dd;
$$;
grant execute on function public.get_month_moods(date, date) to authenticated;

notify pgrst, 'reload schema';
