-- ─── Video Vault: tabela de URLs gerenciadas pelo admin ──────────────────────
-- Execute no Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists vault_videos (
  id          uuid        primary key default gen_random_uuid(),
  category    text        not null,
  slot        int         not null,          -- 1 ou 2 por categoria
  title       text        not null,
  url         text        not null,          -- URL pública do R2
  active      boolean     not null default true,
  updated_at  timestamptz not null default now(),
  unique (category, slot)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table vault_videos enable row level security;

-- Leitura pública (o generate route lê sem auth de usuário final)
create policy "vault_read"
  on vault_videos for select
  using (true);

-- Escrita apenas para usuários autenticados (admin)
create policy "vault_write"
  on vault_videos for all
  using (auth.role() = 'authenticated');

-- ── Índice por categoria ──────────────────────────────────────────────────────
create index if not exists vault_videos_category_idx on vault_videos (category, slot);
