-- ISA — Theme preference. Run in the Supabase SQL Editor.
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  theme_preference text not null default 'boys' check (theme_preference in ('boys','girls')),
  created_at       timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "owner_all" on public.profiles;
create policy "owner_all" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
notify pgrst, 'reload schema';
