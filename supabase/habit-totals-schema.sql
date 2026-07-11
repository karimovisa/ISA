-- ISA — Total (lifetime) completed-days count per habit, shown as a badge
-- on the habit row. Separate from get_my_habit_streaks() (current
-- consecutive streak) — this counts every completed day since the habit
-- was created, streak or not. Run in the Supabase SQL Editor.

create or replace function public.get_my_habit_totals()
returns table (habit_id uuid, total int)
language sql security definer set search_path = public as $$
  select hl.habit_id, count(*)::int as total
  from habit_logs hl
  join habits h on h.id = hl.habit_id
  where h.user_id = auth.uid() and hl.completed
  group by hl.habit_id;
$$;

grant execute on function public.get_my_habit_totals() to authenticated;

notify pgrst, 'reload schema';
