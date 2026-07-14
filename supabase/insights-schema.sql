-- ISA — Pattern & Insight Engine (Subsystem #4). Analysis layer only.
-- Reads Memory Engine + life_events → deterministic insights. Additive. Nightly.
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null,
  subject_key text not null default '',
  title text not null,
  detail text not null default '',
  valence text not null default 'neutral' check (valence in ('positive','neutral','negative')),
  confidence real not null default 0.5 check (confidence between 0 and 1),
  importance_score real not null default 0.5 check (importance_score between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  source text not null default 'auto',
  status text not null default 'active' check (status in ('active','dismissed','archived')),
  created_at timestamptz not null default now()
);
create index if not exists ai_insights_user_type on public.ai_insights(user_id, insight_type);
create index if not exists ai_insights_user_score on public.ai_insights(user_id, importance_score desc);
alter table public.ai_insights enable row level security;
drop policy if exists "owner_all" on public.ai_insights;
create policy "owner_all" on public.ai_insights for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.generate_insights_for(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from ai_insights where user_id=p_user and source='auto';

  -- recurring behavior / consistency (from consolidated behavior memory)
  insert into ai_insights(user_id,insight_type,subject_key,title,detail,valence,confidence,importance_score,evidence)
  select p_user, case when occurrence_count>=8 then 'recurring' else 'consistency' end,
    subject_key, 'Consistent: '||title,
    format('%s events recorded (avg intensity %s).', occurrence_count, magnitude_avg),
    'positive', least(1, occurrence_count/12.0)::real, importance_score,
    jsonb_build_object('occurrence_count',occurrence_count,'magnitude_avg',magnitude_avg)
  from ai_memory where user_id=p_user and memory_type='behavior' and occurrence_count>=3;

  -- milestones reached
  insert into ai_insights(user_id,insight_type,subject_key,title,detail,valence,confidence,importance_score,evidence)
  select p_user, 'milestone', subject_key, 'Milestone: '||title, summary, 'positive', 0.9, importance_score, data
  from ai_memory where user_id=p_user and memory_type='milestone';

  -- correlations (co-occurring areas — related, not causal)
  insert into ai_insights(user_id,insight_type,subject_key,title,detail,valence,confidence,importance_score,evidence)
  select p_user, 'correlation', fa.subject_key||' + '||ta.subject_key,
    'These tend to happen together',
    format('%s and %s were both active on %s day(s) — related, not necessarily causal.', fa.subject_key, ta.subject_key, r.weight),
    'neutral', least(1, r.weight/5.0)::real, 0.5,
    jsonb_build_object('a',fa.subject_key,'b',ta.subject_key,'shared_days',r.weight)
  from memory_relationships r
  join ai_memory fa on fa.id=r.from_memory join ai_memory ta on ta.id=r.to_memory
  where r.user_id=p_user and r.rel_type='co_active' and r.weight>=2;

  -- weekly trends (7d vs prev 7d) — positive_trend / negative_trend / emerging
  with wk as (
    select source_module||':'||category subj,
      count(*) filter (where occurred_at >= now()-interval '7 days') c_now,
      count(*) filter (where occurred_at < now()-interval '7 days' and occurred_at >= now()-interval '14 days') c_prev
    from life_events where user_id=p_user and occurred_at >= now()-interval '14 days'
    group by 1
  )
  insert into ai_insights(user_id,insight_type,subject_key,title,detail,valence,confidence,importance_score,evidence)
  select p_user,
    case when c_prev=0 then 'emerging' when c_now>c_prev then 'positive_trend' else 'negative_trend' end,
    subj,
    case when c_prev=0 then 'New pattern: '||subj else subj||' activity '||case when c_now>c_prev then 'up' else 'down' end end,
    case when c_prev=0 then format('%s appeared this week (%s events).', subj, c_now)
         else format('%s events this week vs %s last week.', c_now, c_prev) end,
    case when c_now>=c_prev then 'positive' else 'negative' end,
    least(1,(c_now+c_prev)/8.0)::real, 0.5,
    jsonb_build_object('this_week',c_now,'last_week',c_prev)
  from wk where c_now<>c_prev or c_prev=0;

  -- anomalies (unusually large single events, not already milestones)
  insert into ai_insights(user_id,insight_type,subject_key,title,detail,valence,confidence,importance_score,evidence)
  select p_user, 'anomaly', source_module||':'||category, 'Unusual: '||event_type,
    format('A notably large %s event (intensity %s).', event_type, magnitude),
    case when valence in ('positive','negative') then valence else 'neutral' end,
    0.6, magnitude,
    jsonb_build_object('event_type',event_type,'magnitude',magnitude,'occurred_at',occurred_at)
  from life_events
  where user_id=p_user and importance<>'pivotal' and magnitude>=0.75 and occurred_at>=now()-interval '14 days';
end $$;

create or replace function public.generate_my_insights() returns void language plpgsql security definer set search_path=public as $$ begin perform public.generate_insights_for(auth.uid()); end $$;
create or replace function public.generate_all_insights() returns void language plpgsql security definer set search_path=public as $$ declare u uuid; begin for u in select distinct user_id from ai_memory loop perform public.generate_insights_for(u); end loop; end $$;
select cron.schedule('insights-generate','30 2 * * *','select public.generate_all_insights()');
notify pgrst,'reload schema';
