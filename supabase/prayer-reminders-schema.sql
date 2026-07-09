-- ISA — Hourly "not yet prayed" reminders. Run in the Supabase SQL Editor.
-- Dedups so each (user, date, prayer, hour-since-start) fires at most once,
-- letting the every-5-min cron re-check without spamming.

create table if not exists public.prayer_reminders_sent (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  prayer_name text not null,
  hour_slot   int  not null,   -- 1 = 1h after start, 2 = 2h after start, ...
  sent_at     timestamptz not null default now(),
  primary key (user_id, date, prayer_name, hour_slot)
);

alter table public.prayer_reminders_sent enable row level security;
drop policy if exists "owner_all" on public.prayer_reminders_sent;
create policy "owner_all" on public.prayer_reminders_sent
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
