-- ============================================================
-- SUARIK — Setup do banco de dados
-- Cole no SQL Editor do Supabase e execute
-- ============================================================

-- 1. Tabela de perfis de usuário
create table if not exists public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text,
  full_name     text,
  avatar_url    text,
  plan          text default 'free',        -- 'free' | 'starter' | 'pro' | 'agency'
  credits       integer default 100,        -- créditos de geração (100 no plano free)
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  subscription_status     text default 'inactive', -- 'active' | 'inactive' | 'canceled'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. Row Level Security
alter table public.profiles enable row level security;

create policy "Usuário vê só o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuário atualiza só o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Criar perfil automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Tabela de histórico de gerações
create table if not exists public.generations (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  type        text,   -- 'copy' | 'video'
  niche       text,
  credits_used integer default 1,
  created_at  timestamptz default now()
);

alter table public.generations enable row level security;

create policy "Usuário vê próprias gerações"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Usuário insere próprias gerações"
  on public.generations for insert
  with check (auth.uid() = user_id);

-- 5. Tabela de projetos (resultados gerados)
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tool        text not null,        -- 'storyboard' | 'audio' | 'lipsync' | 'voiceclone' | 'dreamact' | ...
  title       text not null,
  result_url  text,                 -- URL pública do arquivo gerado (R2)
  thumb_url   text,                 -- Thumbnail (opcional)
  meta        jsonb default '{}',   -- Metadados extras (duração, cenas, etc.)
  created_at  timestamptz default now()
);

alter table public.projects enable row level security;

create policy "users see own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "users insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "users delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- 6. Atualizar trigger para dar 100 créditos ao cadastrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, credits)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    100
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
