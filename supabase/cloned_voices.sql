-- ─── Cloned voices: persistência server-side ────────────────────────────────
-- Execute no Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cloned_voices (
  voice_id    text        primary key,   -- ID único da MiniMax
  user_id     uuid        not null references auth.users(id) on delete cascade,
  voice_name  text        not null check (length(voice_name) between 1 and 80),
  sample_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cloned_voices_user_idx on cloned_voices(user_id, created_at desc);

alter table cloned_voices enable row level security;

-- Usuário só vê / modifica suas próprias vozes
create policy "cloned_voices_select_own"
  on cloned_voices for select
  using (auth.uid() = user_id);

create policy "cloned_voices_insert_own"
  on cloned_voices for insert
  with check (auth.uid() = user_id);

create policy "cloned_voices_update_own"
  on cloned_voices for update
  using (auth.uid() = user_id);

create policy "cloned_voices_delete_own"
  on cloned_voices for delete
  using (auth.uid() = user_id);
