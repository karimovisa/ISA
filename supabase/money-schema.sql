-- ISA — Money / Finance module. Run in the Supabase SQL Editor.

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('income','expense')),
  amount      numeric not null check (amount > 0),
  category    text not null default 'Other',
  note        text,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);
alter table public.transactions enable row level security;
drop policy if exists "owner_all" on public.transactions;
create policy "owner_all" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.finance_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  target_amount  numeric not null check (target_amount > 0),
  current_amount numeric not null default 0 check (current_amount >= 0),
  target_date    date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.finance_goals enable row level security;
drop policy if exists "owner_all" on public.finance_goals;
create policy "owner_all" on public.finance_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recurring_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  amount        numeric not null check (amount > 0),
  category      text not null default 'Other',
  day_of_month  int not null check (day_of_month between 1 and 31),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.recurring_payments enable row level security;
drop policy if exists "owner_all" on public.recurring_payments;
create policy "owner_all" on public.recurring_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
