-- ISA — Onboarding. Tracks whether a user has seen the first-launch flow.
-- profiles already has RLS scoped to the owner; adding a column needs nothing more.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

notify pgrst, 'reload schema';
