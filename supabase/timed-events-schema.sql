-- ISA — Today's Timeline: lightweight timed daily events (name + local HH:MM).
-- Applied via Supabase MCP (migration create_timed_events). Kept here for record.
create table if not exists public.timed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_time text not null,           -- local "HH:MM"
  event_date date not null default (now() at time zone 'utc')::date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.timed_events enable row level security;
create policy "timed_events_owner_all" on public.timed_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists timed_events_user_date_idx on public.timed_events(user_id, event_date);
