-- ISA — Daily to-do list. Run in the Supabase SQL Editor.
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  date       date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_date_idx on public.todos (user_id, date);
alter table public.todos enable row level security;
drop policy if exists "owner_all" on public.todos;
create policy "owner_all" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
notify pgrst, 'reload schema';
