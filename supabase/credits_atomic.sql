-- ─── Créditos: RPCs atômicas + constraint ────────────────────────────────────
-- Execute no Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Garante que créditos nunca fiquem negativos (defesa em profundidade)
alter table profiles
  drop constraint if exists profiles_credits_nonnegative;
alter table profiles
  add  constraint profiles_credits_nonnegative check (credits >= 0);

-- ── 2. debit_credits — débito atômico com validação de saldo ─────────────────
-- Retorna novo saldo, ou NULL se saldo insuficiente.
-- Lock de linha via SELECT ... FOR UPDATE garante serialização.
create or replace function debit_credits(p_user_id uuid, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_new     int;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Lock da linha — bloqueia outras transações concorrentes
  select credits into v_current
    from profiles
   where id = p_user_id
   for update;

  if v_current is null then
    return null; -- usuário não existe
  end if;

  if v_current < p_amount then
    return null; -- saldo insuficiente
  end if;

  v_new := v_current - p_amount;
  update profiles set credits = v_new where id = p_user_id;
  return v_new;
end;
$$;

grant execute on function debit_credits(uuid, int) to authenticated, service_role;

-- ── 3. refund_credits — reembolso idempotente ────────────────────────────────
-- Usa tabela credit_refunds para idempotency.
-- Retorna novo saldo ou -1 se refund_id já foi processado.
create table if not exists credit_refunds (
  refund_id   text        primary key,
  user_id     uuid        not null references profiles(id) on delete cascade,
  amount      int         not null check (amount > 0),
  action      text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists credit_refunds_user_idx on credit_refunds(user_id, created_at desc);

create or replace function refund_credits(
  p_user_id   uuid,
  p_amount    int,
  p_action    text,
  p_refund_id text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_new     int;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Idempotency — se refund_id já foi processado, retorna -1
  begin
    insert into credit_refunds(refund_id, user_id, amount, action)
    values (p_refund_id, p_user_id, p_amount, p_action);
  exception
    when unique_violation then
      return -1;
  end;

  -- Lock de linha e soma
  select credits into v_current
    from profiles
   where id = p_user_id
   for update;

  if v_current is null then
    return null;
  end if;

  v_new := v_current + p_amount;
  update profiles set credits = v_new where id = p_user_id;
  return v_new;
end;
$$;

grant execute on function refund_credits(uuid, int, text, text) to authenticated, service_role;

-- ── 4. add_credits — crédito simples (topup / signup bonus) ──────────────────
create or replace function add_credits(p_user_id uuid, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_new     int;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select credits into v_current from profiles where id = p_user_id for update;
  if v_current is null then return null; end if;

  v_new := v_current + p_amount;
  update profiles set credits = v_new where id = p_user_id;
  return v_new;
end;
$$;

grant execute on function add_credits(uuid, int) to authenticated, service_role;
