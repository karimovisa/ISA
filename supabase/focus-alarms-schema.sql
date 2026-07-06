-- ISA — Focus timer completion push. Run in the Supabase SQL Editor.
-- One open alarm per user; the server pushes + deletes it when end_at passes.

create table if not exists public.focus_alarms (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  label      text,
  duration_s int not null,
  end_at     timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.focus_alarms enable row level security;
drop policy if exists "owner_all" on public.focus_alarms;
create policy "owner_all" on public.focus_alarms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tighten the trigger to every minute so alarms and reminders arrive on time
-- (cron.schedule upserts by job name).
select cron.schedule(
  'isa-reminders',
  '* * * * *',
  $$
  select net.http_get(
    url     := 'https://islom-os.vercel.app/api/push/send?type=custom',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  )
  $$
);

notify pgrst, 'reload schema';
