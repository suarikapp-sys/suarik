-- =============================================================================
-- Copiloto de Edição — Projects RLS Migration
-- Adds Row Level Security policies to the projects table
-- Run once in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- Ensure projects table has RLS enabled (idempotent)
alter table if exists public.projects enable row level security;

-- SELECT policy: users can only see their own projects
create policy if not exists "users see own projects"
  on public.projects for select
  using (auth.uid() = user_id);

-- INSERT policy: users can only insert with their own user_id
create policy if not exists "users insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

-- UPDATE policy: users can only update their own projects
create policy if not exists "users update own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE policy: users can only delete their own projects
create policy if not exists "users delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- Done
-- The projects table now has complete RLS with SELECT, INSERT, UPDATE, DELETE
-- All policies use auth.uid() to check user ownership via the user_id column
