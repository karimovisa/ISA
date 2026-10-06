-- ISA — Ask ISA conversation history. Additive; no existing table is touched.
-- Chats survive a refresh / app restart, and the model sees the real thread.
-- Durable facts ISA learns from chats live in ai_memory (memory_type='user_fact'),
-- written by /api/ask/learn — never the raw transcript.

create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_conv_time         on public.ai_messages (conversation_id, created_at);

do $$ declare t text; begin
  foreach t in array array['ai_conversations','ai_messages'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on public.%I;', t);
    execute format('create policy "owner_all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
