-- ISA — Custom reminders. Run in the Supabase SQL Editor.
-- Requires pg_cron (already enabled) + pg_net (enabled below).

create table if not exists public.reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null default 'custom' check (kind in ('custom','habit','todo')),
  habit_id       uuid references public.habits (id) on delete cascade,
  title          text not null,
  body           text,                                   -- custom notification text (optional)
  remind_time    time not null,                          -- local wall-clock time (UTC+5)
  days           int[] not null default '{0,1,2,3,4,5,6}', -- 0=Sun … 6=Sat
  enabled        boolean not null default true,
  last_sent_date date,                                   -- set by the server after sending
  created_at     timestamptz not null default now()
);
create index if not exists reminders_enabled_idx on public.reminders (enabled, remind_time);

alter table public.reminders enable row level security;
drop policy if exists "owner_all" on public.reminders;
create policy "owner_all" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Trigger: Supabase calls the app every 5 minutes; the app decides what's due.
create extension if not exists pg_net;

select cron.schedule(
  'isa-reminders',
  '*/5 * * * *',
  $$
  select net.http_get(
    url     := 'https://islom-os.vercel.app/api/push/send?type=custom',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  )
  $$
);

notify pgrst, 'reload schema';
