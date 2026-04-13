// ─────────────────────────────────────────────────────────────────────────────
// 🎬 ACERVO PREMIUM DE VÍDEO — Kraft Mídia Video Vault
//
// ❶ Static fallback  — definido aqui (usado quando a tabela Supabase está vazia)
// ❷ DB override      — tabela `vault_videos` no Supabase sobrescreve por categoria
// ❸ Caching          — resultado mergeado fica em memória por 5 min (serverless-safe)
//
// Para activar: crie a tabela `vault_videos` (SQL em /supabase/vault_videos.sql)
// e use a página /admin/vault para colar as URLs do R2.
//
// Categorias (vault_category da IA):
//   🎣 Ganchos    hook_dr_choque · hook_financas_hype · hook_trad_dinamico
//   💊 DR/Info    dr_nutra_dores · dr_nutra_emagrecimento · dr_nutra_cerebro
//                 dr_financas_indenizacoes · dr_financas_renda_extra
//                 dr_relacionamento_seducao
//   🏠 Trad/Creat trad_imobiliario · trad_corporativo · trad_local_food
//                 creator_podcast · creator_vlog
//   🎉 Eventos/EC social_wedding · ecom_beauty · ecom_food_porn
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultVideo {
  title: string;
  url:   string;
}

const R2 = `${process.env.R2_PUBLIC_URL_MIDIAS ?? "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev"}/videos`;

/** Static baseline — works even without DB. Entries with "placeholder" in the URL
 *  are silently skipped by the generate route.  */
export const VIDEO_VAULT: Record<string, VaultVideo[]> = {

  // ── Ganchos (Pattern Interrupt — Primeiros 3 segundos) ─────────────────────
  hook_dr_choque: [
    { title: "DR Choque — Pattern Interrupt",    url: `${R2}/hook_dr_choque/placeholder.mp4` },
    { title: "DR Choque — Revelação Impactante", url: `${R2}/hook_dr_choque/placeholder_02.mp4` },
  ],
  hook_financas_hype: [
    { title: "Finanças Hype — Dinheiro Urgente", url: `${R2}/hook_financas_hype/placeholder.mp4` },
    { title: "Finanças Hype — Conta Explodindo", url: `${R2}/hook_financas_hype/placeholder_02.mp4` },
  ],
  hook_trad_dinamico: [
    { title: "Tradicional Dinâmico — Abertura",  url: `${R2}/hook_trad_dinamico/placeholder.mp4` },
    { title: "Tradicional Dinâmico — Logo Cut",  url: `${R2}/hook_trad_dinamico/placeholder_02.mp4` },
  ],

  // ── Direct Response & Info (Foco em Conversão) ─────────────────────────────
  dr_nutra_dores: [
    { title: "Dores Articulares — Raio-X Joelho",    url: `${R2}/dr_nutra_dores/placeholder.mp4` },
    { title: "Dores Articulares — Alívio Imediato",  url: `${R2}/dr_nutra_dores/placeholder_02.mp4` },
  ],
  dr_nutra_emagrecimento: [
    { title: "Emagrecimento — Transformação Antes/Depois", url: `${R2}/dr_nutra_emagrecimento/placeholder.mp4` },
    { title: "Emagrecimento — Medição de Cintura",         url: `${R2}/dr_nutra_emagrecimento/placeholder_02.mp4` },
  ],
  dr_nutra_cerebro: [
    { title: "Memória — Neurônio Sinapses 3D",  url: `${R2}/dr_nutra_cerebro/placeholder.mp4` },
    { title: "Cognição — Foco Mental Loop",     url: `${R2}/dr_nutra_cerebro/placeholder_02.mp4` },
  ],
  dr_financas_indenizacoes: [
    { title: "Indenizações — Acordo Oficial Selado",  url: `${R2}/dr_financas_indenizacoes/placeholder.mp4` },
    { title: "Indenizações — Público 45-60 Vitória",  url: `${R2}/dr_financas_indenizacoes/placeholder_02.mp4` },
  ],
  dr_financas_renda_extra: [
    { title: "Renda Extra — Dinheiro Contado",   url: `${R2}/dr_financas_renda_extra/placeholder.mp4` },
    { title: "Renda Extra — Laptop & Liberdade", url: `${R2}/dr_financas_renda_extra/placeholder_02.mp4` },
  ],
  dr_relacionamento_seducao: [
    { title: "Relacionamento — Casal Magnético", url: `${R2}/dr_relacionamento_seducao/placeholder.mp4` },
    { title: "Sedução — Confiança & Atração",    url: `${R2}/dr_relacionamento_seducao/placeholder_02.mp4` },
  ],

  // ── Tradicional & Creators ─────────────────────────────────────────────────
  trad_imobiliario: [
    { title: "Imobiliário — Drone Casa de Luxo",    url: `${R2}/trad_imobiliario/placeholder.mp4` },
    { title: "Imobiliário — Sala Ampla Cinemática", url: `${R2}/trad_imobiliario/placeholder_02.mp4` },
  ],
  trad_corporativo: [
    { title: "Corporativo — Sala de Reunião Premium", url: `${R2}/trad_corporativo/placeholder.mp4` },
    { title: "Corporativo — Aperto de Mão Negócio",  url: `${R2}/trad_corporativo/placeholder_02.mp4` },
  ],
  trad_local_food: [
    { title: "Food Local — Balcão Acolhedor",        url: `${R2}/trad_local_food/placeholder.mp4` },
    { title: "Food Local — Ambiente do Restaurante", url: `${R2}/trad_local_food/placeholder_02.mp4` },
  ],
  creator_podcast: [
    { title: "Podcast — Estúdio Cinemático",      url: `${R2}/creator_podcast/placeholder.mp4` },
    { title: "Podcast — Microfone Detalhe Bokeh", url: `${R2}/creator_podcast/placeholder_02.mp4` },
  ],
  creator_vlog: [
    { title: "Vlog — Lifestyle Câmera na Mão", url: `${R2}/creator_vlog/placeholder.mp4` },
    { title: "Vlog — Dia a Dia Autêntico",     url: `${R2}/creator_vlog/placeholder_02.mp4` },
  ],

  // ── Eventos & E-commerce ───────────────────────────────────────────────────
  social_wedding: [
    { title: "Casamento — Slow Motion Cinemático", url: `${R2}/social_wedding/placeholder.mp4` },
    { title: "Casamento — Casal Hora Dourada",     url: `${R2}/social_wedding/placeholder_02.mp4` },
  ],
  ecom_beauty: [
    { title: "Beauty — Produto Macro Cinemático", url: `${R2}/ecom_beauty/placeholder.mp4` },
    { title: "Beauty — Textura Skincare Close",   url: `${R2}/ecom_beauty/placeholder_02.mp4` },
  ],
  ecom_food_porn: [
    { title: "Food Porn — Hero Shot Macro",         url: `${R2}/ecom_food_porn/placeholder.mp4` },
    { title: "Food Porn — Detalhe Slow Mo Cozinha", url: `${R2}/ecom_food_porn/placeholder_02.mp4` },
  ],

};

// ─── Live vault with DB overrides ────────────────────────────────────────────
// Cached in-process for 5 minutes so we don't hit the DB on every generation.

let _cache: Record<string, VaultVideo[]> | null = null;
let _cacheAt = 0;
const TTL = 5 * 60_000;

export type VaultRow = {
  category: string;
  slot:     number;
  title:    string;
  url:      string;
  active:   boolean;
};

/** Returns the merged vault (DB overrides on top of static fallback).
 *  Safe to call from server-side code only. */
export async function getVaultVideos(): Promise<Record<string, VaultVideo[]>> {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache;

  try {
    // Dynamic import so this file can also be imported in non-async contexts.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vault_videos")
      .select("category, slot, title, url")
      .eq("active", true)
      .order("category")
      .order("slot");

    if (!error && data && data.length > 0) {
      // Group DB rows by category, sorted by slot
      const byCategory: Record<string, VaultVideo[]> = {};
      for (const row of (data as VaultRow[])) {
        if (!byCategory[row.category]) byCategory[row.category] = [];
        byCategory[row.category].push({ title: row.title, url: row.url });
      }
      // Merge: DB entries override the matching static category
      _cache = { ...VIDEO_VAULT, ...byCategory };
      _cacheAt = Date.now();
      return _cache;
    }
  } catch {
    // DB not set up yet — degrade gracefully to static file
  }

  return VIDEO_VAULT;
}

/** Bust the in-process cache (call after any admin write). */
export function bustVaultCache() {
  _cache  = null;
  _cacheAt = 0;
}
