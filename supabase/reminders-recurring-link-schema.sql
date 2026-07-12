-- ISA — Link recurring payments to the reminders/push system.
-- Adds day-of-month scheduling (reminders previously only supported
-- day-of-week) and a recurring_payment_id FK so deleting a payment
-- cleans up its reminder automatically. Run in the Supabase SQL Editor
-- (already applied live via the Supabase connector on 2026-07-12).

alter table public.reminders
  add column if not exists day_of_month int check (day_of_month between 1 and 31),
  add column if not exists recurring_payment_id uuid references public.recurring_payments (id) on delete cascade;

alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('custom','habit','todo','recurring'));

create unique index if not exists reminders_recurring_payment_uidx
  on public.reminders (recurring_payment_id) where recurring_payment_id is not null;

notify pgrst, 'reload schema';
