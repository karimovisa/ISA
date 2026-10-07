-- ISA — Category budgets ("envelopes"). Optional layer over transactions: a
-- spending limit per expense category, weekly or monthly. Additive; no existing
-- table is touched. One row per (user, category).

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   text not null,
  amount     numeric(14, 0) not null check (amount > 0),
  period     text not null default 'month' check (period in ('week', 'month')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)  -- also serves as the user_id index for RLS
);

alter table public.budgets enable row level security;
drop policy if exists "owner_all" on public.budgets;
create policy "owner_all" on public.budgets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
