-- ISA — Customizable bottom-nav (mobile) order. Run in the Supabase SQL Editor.
-- Stores the user's preferred order of the 6 bottom-bar items as a JSON
-- array of hrefs, e.g. ["/", "/habits", "/goals", "/journal", "/focus", "/progress"].
-- null/missing = use the app default order.

alter table public.profiles
  add column if not exists nav_order jsonb;

notify pgrst, 'reload schema';
