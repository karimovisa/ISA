-- ISA — Web Push. Run in the Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  keys_p256dh text not null,
  keys_auth   text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.notification_settings (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default false
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
drop policy if exists "owner_all" on public.push_subscriptions;
create policy "owner_all" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on public.notification_settings;
create policy "owner_all" on public.notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
