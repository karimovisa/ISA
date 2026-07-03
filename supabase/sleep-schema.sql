-- ISA — Sleep tracking + Energy Score. Run in the Supabase SQL Editor.
-- Requires the pg_cron extension (Dashboard → Database → Extensions → enable "pg_cron").

create table if not exists public.sleep_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  date           date not null,
  sleep_start    timestamptz,
  sleep_end      timestamptz,
  duration_hours numeric not null,
  quality        int check (quality between 1 and 5),
  created_at     timestamptz not null default now()
);
create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);

create table if not exists public.daily_energy_scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  score      int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.sleep_logs enable row level security;
alter table public.daily_energy_scores enable row level security;

drop policy if exists "owner_all" on public.sleep_logs;
create policy "owner_all" on public.sleep_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_read" on public.daily_energy_scores;
create policy "owner_read" on public.daily_energy_scores
  for select using (auth.uid() = user_id);

-- ---------- Energy Score = Sleep×0.75 + Consistency×0.25 ----------
create or replace function public.compute_energy_score(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours numeric;
  v_sleep int;
  v_stddev numeric;
  v_consistency int;
begin
  select duration_hours into v_hours
  from sleep_logs where user_id = p_user and date = p_date
  order by created_at desc limit 1;

  if v_hours is null then
    delete from daily_energy_scores where user_id = p_user and date = p_date;
    return;
  end if;

  v_sleep := case
    when v_hours >= 7 and v_hours <= 9 then 100
    when (v_hours >= 6 and v_hours < 7) or (v_hours > 9 and v_hours <= 10) then 70
    when v_hours >= 5 and v_hours < 6 then 50
    else 30
  end;

  -- Consistency: stddev (minutes) of bedtime over the last 7 days.
  -- Bedtimes after midnight are shifted +24h so late nights cluster together.
  select stddev_pop(m) into v_stddev from (
    select extract(hour from sleep_start) * 60 + extract(minute from sleep_start)
           + case when extract(hour from sleep_start) < 12 then 1440 else 0 end as m
    from sleep_logs
    where user_id = p_user and sleep_start is not null
      and date > p_date - 7 and date <= p_date
  ) t;

  v_consistency := case
    when v_stddev is null then 100      -- not enough data → assume consistent
    when v_stddev < 30 then 100
    when v_stddev < 60 then 70
    when v_stddev < 90 then 40
    else 20
  end;

  insert into daily_energy_scores (user_id, date, score)
  values (p_user, p_date, round(v_sleep * 0.75 + v_consistency * 0.25))
  on conflict (user_id, date) do update set score = excluded.score;
end $$;

-- Callable by the app right after logging (uses the caller's identity).
create or replace function public.recompute_my_energy(p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.compute_energy_score(auth.uid(), p_date);
end $$;
grant execute on function public.recompute_my_energy(date) to authenticated;

-- Nightly job: recompute for everyone who logged in the last day.
create or replace function public.compute_all_energy_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in select distinct user_id, date from sleep_logs where date >= current_date - 1 loop
    perform public.compute_energy_score(r.user_id, r.date);
  end loop;
end $$;

-- Schedule 07:00 daily (safe to run once; re-running errors if the job exists).
select cron.schedule('daily-energy', '0 7 * * *', 'select public.compute_all_energy_scores()');
