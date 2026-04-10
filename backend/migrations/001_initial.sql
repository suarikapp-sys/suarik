-- =============================================================================
-- Copiloto de Edição — Initial Migration
-- Run once in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================


-- ── 1. video_jobs table ───────────────────────────────────────────────────────
-- Stores every async generation job with its status and result payload.

create table if not exists video_jobs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  status      text        not null default 'processing'
                          check (status in ('processing', 'completed', 'failed')),
  payload     jsonb,                        -- stores the generated timeline JSON on completion
  coin_cost   int         not null default 0,
  error_msg   text,
  result_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index: fast lookup of a user's active jobs (used by concurrency gate)
create index if not exists idx_video_jobs_user_status
  on video_jobs (user_id, status);

-- Auto-update updated_at on every row change
create or replace function _set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_video_jobs_updated_at on video_jobs;
create trigger trg_video_jobs_updated_at
  before update on video_jobs
  for each row execute function _set_updated_at();

-- RLS: users can only read their own jobs (backend uses service-role key, bypasses RLS)
alter table video_jobs enable row level security;

create policy "Users see own jobs"
  on video_jobs for select
  using (auth.uid() = user_id);


-- ── 2. add_coins RPC ──────────────────────────────────────────────────────────
-- Atomically increments the credits column.
-- Used by: economy.refund()

create or replace function add_coins(uid uuid, amount int)
returns int language plpgsql
security definer                        -- runs as DB owner, bypasses RLS safely
as $$
declare
  new_balance int;
begin
  update profiles
     set credits = credits + amount
   where id = uid
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'user_not_found: %', uid using errcode = 'P0001';
  end if;

  return new_balance;
end;
$$;


-- ── 3. deduct_coins RPC ───────────────────────────────────────────────────────
-- Atomically checks balance and decrements it in one transaction.
-- Returns new balance, or -1 if the user cannot afford the amount.
-- Used by: economy.check_and_deduct()

create or replace function deduct_coins(uid uuid, amount int)
returns int language plpgsql
security definer
as $$
declare
  current_balance int;
  new_balance     int;
begin
  -- FOR UPDATE locks the row so concurrent requests queue up here
  select credits into current_balance
    from profiles
   where id = uid
     for update;

  if current_balance is null then
    raise exception 'user_not_found: %', uid using errcode = 'P0001';
  end if;

  -- Sentinel: caller interprets -1 as "insufficient funds" → raises HTTP 402
  if current_balance < amount then
    return -1;
  end if;

  update profiles
     set credits = credits - amount
   where id = uid
  returning credits into new_balance;

  return new_balance;
end;
$$;


-- ── Done ──────────────────────────────────────────────────────────────────────
-- After running this script, your database has:
--   • video_jobs table with RLS, indexes, and auto-updated_at trigger
--   • add_coins(uid, amount)    → int  (new balance)
--   • deduct_coins(uid, amount) → int  (new balance, or -1 if broke)
