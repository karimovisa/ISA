-- ISA — Subscription & Entitlement System. Additive; single source of truth
-- for permissions. Plan matrix is fully DB-configurable (change plans w/o code).
create table if not exists public.plans(
  plan_key text primary key, name text not null, rank int not null default 0,
  is_public boolean not null default true, created_at timestamptz default now());
insert into public.plans(plan_key,name,rank,is_public) values
 ('free','Free',0,true),('pro','Pro',10,true),('education','Education',15,true),
 ('family','Family',20,true),('team','Team',30,true),('lifetime','Lifetime',40,true),
 ('enterprise','Enterprise',50,false)
on conflict (plan_key) do nothing;

create table if not exists public.plan_features(
  plan_key text not null references public.plans(plan_key) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  usage_limit int,                    -- null = unlimited
  period text check (period in ('day','month')),
  primary key (plan_key,feature_key));

insert into public.plan_features(plan_key,feature_key,enabled,usage_limit,period) values
 ('free','core_modules',true,null,null),('free','memory_engine',true,null,null),
 ('free','basic_insights',true,null,null),('free','weekly_review',true,null,null),
 ('free','export_json',true,null,null),('free','ai_summaries',true,3,'day'),
 ('free','exports',true,3,'month'),('free','pattern_detection',false,null,null),
 ('free','ai_predictions',false,null,null),('free','ai_coach',false,null,null),
 ('free','monthly_review',false,null,null),('free','yearly_review',false,null,null),
 ('free','deep_analytics',false,null,null),('free','nl_search',false,null,null),
 ('free','export_pdf',false,null,null),('free','unlimited_history',false,null,null)
on conflict do nothing;
insert into public.plan_features(plan_key,feature_key,enabled,usage_limit,period)
select 'pro',feature_key,true,null,null from public.plan_features where plan_key='free'
on conflict do nothing;
insert into public.plan_features(plan_key,feature_key,enabled,usage_limit,period)
select p.plan_key,f.feature_key,f.enabled,f.usage_limit,f.period
from public.plans p cross join public.plan_features f
where f.plan_key='pro' and p.plan_key in ('education','family','team','lifetime','enterprise')
on conflict do nothing;

create table if not exists public.subscriptions(
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null default 'free' references public.plans(plan_key),
  status text not null default 'active'
    check (status in ('active','trial','expired','cancelled','paused','lifetime')),
  trial_ends_at timestamptz, current_period_end timestamptz, cancel_at timestamptz,
  provider text, customer_id text, subscription_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.usage_counters(
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null, window_start date not null, period text not null,
  count int not null default 0, primary key (user_id,feature_key,window_start));

alter table public.subscriptions enable row level security;
drop policy if exists "owner_sel" on public.subscriptions;
create policy "owner_sel" on public.subscriptions for select using (auth.uid()=user_id);
drop policy if exists "owner_ins" on public.subscriptions;
create policy "owner_ins" on public.subscriptions for insert with check (auth.uid()=user_id);
alter table public.usage_counters enable row level security;
drop policy if exists "owner_all" on public.usage_counters;
create policy "owner_all" on public.usage_counters for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
alter table public.plans enable row level security;
drop policy if exists "read_all" on public.plans;
create policy "read_all" on public.plans for select using (true);
alter table public.plan_features enable row level security;
drop policy if exists "read_all" on public.plan_features;
create policy "read_all" on public.plan_features for select using (true);

insert into public.subscriptions(user_id) select id from auth.users on conflict do nothing;

create or replace function public.current_plan(p_user uuid) returns text
language sql stable security definer set search_path=public as $$
 select coalesce((select case
   when s.status in ('active','lifetime') then s.plan_key
   when s.status='trial' and coalesce(s.trial_ends_at,now())>now() then s.plan_key
   else 'free' end
  from subscriptions s where s.user_id=p_user),'free');
$$;

create or replace function public.has_feature(p_user uuid, fk text) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select enabled from plan_features
   where plan_key=public.current_plan(p_user) and feature_key=fk),false);
$$;

create or replace function public.my_entitlements() returns jsonb
language sql stable security definer set search_path=public as $$
 with pk as (select public.current_plan(auth.uid()) plan),
 s as (select * from subscriptions where user_id=auth.uid()),
 feats as (
   select f.feature_key,f.enabled,f.usage_limit,f.period,
     coalesce((select count from usage_counters u where u.user_id=auth.uid()
       and u.feature_key=f.feature_key and u.window_start=
       case f.period when 'day' then current_date when 'month' then date_trunc('month',now())::date else current_date end),0) used
   from plan_features f,pk where f.plan_key=pk.plan)
 select jsonb_build_object(
   'plan',(select plan from pk),
   'status',coalesce((select status from s),'active'),
   'trial_ends_at',(select trial_ends_at from s),
   'current_period_end',(select current_period_end from s),
   'features',(select jsonb_object_agg(feature_key,jsonb_build_object(
     'enabled',enabled,'limit',usage_limit,'used',used,
     'remaining',case when usage_limit is null then null else greatest(0,usage_limit-used) end)) from feats));
$$;

create or replace function public.use_feature(fk text) returns boolean
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); lim int; per text; ws date; c int;
begin
 if not public.has_feature(u,fk) then return false; end if;
 select usage_limit,period into lim,per from plan_features
   where plan_key=public.current_plan(u) and feature_key=fk;
 if lim is null then return true; end if;
 ws := case per when 'day' then current_date when 'month' then date_trunc('month',now())::date else current_date end;
 insert into usage_counters(user_id,feature_key,window_start,period,count)
   values(u,fk,ws,coalesce(per,'day'),0) on conflict (user_id,feature_key,window_start) do nothing;
 select count into c from usage_counters where user_id=u and feature_key=fk and window_start=ws;
 if c>=lim then return false; end if;
 update usage_counters set count=count+1 where user_id=u and feature_key=fk and window_start=ws;
 return true;
end $$;

notify pgrst,'reload schema';
