-- ISA — Prayer notification dedup (optional but recommended).
-- Lets the prayer push fire within 10 min of the start (so a slightly delayed
-- cron still delivers) while sending each prayer exactly once. Run in Supabase.
-- Without this table the push still works, but only on the exact start minute.

create table if not exists public.prayer_sent (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  prayer_name text not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, date, prayer_name)
);

alter table public.prayer_sent enable row level security;
drop policy if exists "owner_all" on public.prayer_sent;
create policy "owner_all" on public.prayer_sent
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
