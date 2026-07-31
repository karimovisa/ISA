-- ISA — Calendar events (meetings/appointments) with lead-time push reminders.
-- The 5-minute reminders cron (api/push/send?type=custom, see reminders-schema.sql)
-- scans this table and fires two nudges per event: one day before and one hour
-- before the event's local time. `notified_*` flags dedupe so each fires once.
-- Applied via Supabase MCP (migration calendar_events). Kept here for record.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_time text,                       -- local "HH:MM"; null = all-day (no time-based reminders)
  notes text,
  remind_day_before boolean not null default true,
  remind_hour_before boolean not null default true,
  notified_day_before boolean not null default false,
  notified_hour_before boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
drop policy if exists "calendar_events_owner_all" on public.calendar_events;
create policy "calendar_events_owner_all" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists calendar_events_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists calendar_events_pending_idx
  on public.calendar_events(event_date)
  where not (notified_day_before and notified_hour_before);
