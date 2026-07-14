-- ISA — Payment Layer schema (additive, provider-agnostic).
-- Extends the existing Subscription/Entitlement system (subscriptions-schema.sql)
-- WITHOUT changing it. Adds: configurable pricing, payment ledger + audit,
-- subscription history, and the activation RPC the billing code already calls.
-- Safe to run more than once (idempotent). Apply in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ─────────────────────────── PRICING (configurable, never hardcoded) ───────────────────────────
create table if not exists public.pricing(
  plan_key text not null references public.plans(plan_key) on delete cascade,
  currency text not null default 'UZS' check (currency in ('UZS','USD','EUR','GBP')),
  interval text not null default 'month' check (interval in ('month','year','once')),
  amount numeric not null check (amount >= 0),
  is_launch boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan_key, currency, interval));

insert into public.pricing(plan_key,currency,interval,amount,is_launch,active) values
  ('pro','UZS','month',20000,true,true)
on conflict (plan_key,currency,interval) do nothing;

-- ─────────────────────────── PAYMENTS (the transaction ledger) ───────────────────────────
create table if not exists public.payments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- from merchant_trans_id
  provider text not null default 'click',
  provider_trans_id text not null,                            -- e.g. click_trans_id
  merchant_prepare_id text,
  plan_key text not null default 'pro' references public.plans(plan_key),
  amount numeric not null check (amount >= 0),
  currency text not null default 'UZS' check (currency in ('UZS','USD','EUR','GBP')),
  state text not null default 'pending'
    check (state in ('pending','preparing','paid','completed','cancelled','expired','failed','refunded')),
  error_code int,
  sign_time text,
  ip text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (provider, provider_trans_id)); -- idempotency: one row per provider transaction

create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_state_idx on public.payments(state);

-- ─────────────────────────── PAYMENT ATTEMPTS (every provider callback) ───────────────────────────
create table if not exists public.payment_attempts(
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  provider text not null,
  provider_trans_id text,
  action text,          -- 'prepare' | 'complete' | provider-specific
  success boolean not null default false,
  error_code int,
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now());

create index if not exists payment_attempts_payment_idx on public.payment_attempts(payment_id);

-- ─────────────────────────── PAYMENT LOGS (append-only event trail) ───────────────────────────
create table if not exists public.payment_logs(
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments(id) on delete set null,
  provider text,
  provider_trans_id text,
  event text not null,  -- 'state_change' | 'activation' | 'webhook' | 'error' | ...
  message text,
  data jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now());

create index if not exists payment_logs_payment_idx on public.payment_logs(payment_id);

-- ─────────────────────────── SUBSCRIPTION HISTORY (activations & renewals) ───────────────────────────
create table if not exists public.subscription_history(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null references public.plans(plan_key),
  provider text not null,
  transaction_id text not null,
  invoice_id text,
  amount numeric,
  currency text not null default 'UZS',
  period_start timestamptz not null,
  period_end timestamptz not null,
  kind text not null default 'activation' check (kind in ('activation','renewal','extension','refund')),
  created_at timestamptz not null default now(),
  unique (provider, transaction_id)); -- idempotency: a provider txn applies once

create index if not exists subscription_history_user_idx on public.subscription_history(user_id);

-- ─────────────────────────── updated_at trigger for payments ───────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ─────────────────────────── RLS ───────────────────────────
-- Pricing is public-readable (the upgrade screen needs it). Ledger rows are
-- owner-readable for a billing history UI; the raw audit tables are server-only
-- (RLS on, no client policy = deny). All writes happen via the service role.
alter table public.pricing enable row level security;
drop policy if exists "read_all" on public.pricing;
create policy "read_all" on public.pricing for select using (true);

alter table public.payments enable row level security;
drop policy if exists "owner_sel" on public.payments;
create policy "owner_sel" on public.payments for select using (auth.uid() = user_id);

alter table public.subscription_history enable row level security;
drop policy if exists "owner_sel" on public.subscription_history;
create policy "owner_sel" on public.subscription_history for select using (auth.uid() = user_id);

alter table public.payment_attempts enable row level security; -- server-only (no policy)
alter table public.payment_logs enable row level security;     -- server-only (no policy)

-- ─────────────────────────── ACTIVATION RPC (provider-agnostic) ───────────────────────────
-- The one place a subscription becomes/renews Pro. Idempotent per provider
-- transaction; stacks renewals from the current period end. Called by the
-- service role from payment routes (never by a browser session).
create or replace function public.activate_pro(
  p_user uuid,
  p_provider text,
  p_txn text,
  p_amount numeric,
  p_currency text default 'UZS',
  p_plan text default 'pro',
  p_invoice text default null,
  p_period_months int default 1
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz := now();
  v_base timestamptz;
  v_end timestamptz;
  v_kind text := 'activation';
  v_dup_end timestamptz;
begin
  -- Idempotency — this exact provider transaction has already been applied.
  select period_end into v_dup_end from subscription_history
    where provider = p_provider and transaction_id = p_txn limit 1;
  if v_dup_end is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'period_end', v_dup_end);
  end if;

  -- Renewal stacking: extend from the later of now / current period end.
  select greatest(v_now, coalesce(current_period_end, v_now)) into v_base
    from subscriptions where user_id = p_user;
  v_base := coalesce(v_base, v_now);
  if v_base > v_now then v_kind := 'renewal'; end if;
  v_end := v_base + make_interval(months => p_period_months);

  insert into subscriptions(user_id, plan_key, status, provider, current_period_end, updated_at)
    values (p_user, p_plan, 'active', p_provider, v_end, v_now)
  on conflict (user_id) do update set
    plan_key = excluded.plan_key, status = 'active', provider = excluded.provider,
    current_period_end = excluded.current_period_end, cancel_at = null, updated_at = v_now;

  insert into subscription_history(
    user_id, plan_key, provider, transaction_id, invoice_id, amount, currency,
    period_start, period_end, kind)
  values (p_user, p_plan, p_provider, p_txn, p_invoice, p_amount, p_currency,
    v_base, v_end, v_kind);

  return jsonb_build_object('ok', true, 'duplicate', false, 'kind', v_kind, 'period_end', v_end);
end $$;

notify pgrst, 'reload schema';
