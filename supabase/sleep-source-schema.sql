-- ISA — Sleep redesign (morning-first). Adds provenance to sleep_logs so the app
-- can distinguish real vs estimated vs future health-device data, and never has
-- to fabricate a value. Additive only — run in the Supabase SQL Editor.
--
-- Priority the app applies when reading a day's sleep:
--   1. health_data  (Apple Health / Health Connect — future)
--   2. manual       (user typed / corrected bedtime & wake)
--   3. estimated    (derived from the user's own history, clearly labelled)
--   4. no row       (show "no data", never a fake number)

alter table public.sleep_logs add column if not exists source text;
alter table public.sleep_logs add column if not exists is_estimated boolean not null default false;
alter table public.sleep_logs add column if not exists updated_at timestamptz not null default now();

-- Existing rows predate the estimator: they were all entered by the user.
update public.sleep_logs set source = 'manual' where source is null;

alter table public.sleep_logs drop constraint if exists sleep_logs_source_check;
alter table public.sleep_logs
  add constraint sleep_logs_source_check
  check (source is null or source in ('manual','estimated','health_data'));
