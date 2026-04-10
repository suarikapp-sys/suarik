// ─────────────────────────────────────────────────────────────────────────────
// 🎬 ACERVO PREMIUM DE VÍDEO — Kraft Mídia Video Vault
//
// Prioridade máxima por cena: estes clipes são injectados ANTES dos resultados
// do Pexels no array video_options, com source: "Premium Vault".
//
// Para activar uma categoria, substitua o placeholder pela URL pública do R2.
// Estrutura do bucket:  videos/{categoria}/nome-do-ficheiro.mp4
//
// Categorias disponíveis para o vault_category da IA:
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
    { title: "Dores Articulares — Raio-X Joelho", url: `${R2}/dr_nutra_dores/placeholder.mp4` },
    { title: "Dores Articulares — Alívio Imediato", url: `${R2}/dr_nutra_dores/placeholder_02.mp4` },
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
    { title: "Indenizações — Acordo Oficial Selado",   url: `${R2}/dr_financas_indenizacoes/placeholder.mp4` },
    { title: "Indenizações — Público 45-60 Vitória",   url: `${R2}/dr_financas_indenizacoes/placeholder_02.mp4` },
  ],
  dr_financas_renda_extra: [
    { title: "Renda Extra — Dinheiro Contado",        url: `${R2}/dr_financas_renda_extra/placeholder.mp4` },
    { title: "Renda Extra — Laptop & Liberdade",      url: `${R2}/dr_financas_renda_extra/placeholder_02.mp4` },
  ],
  dr_relacionamento_seducao: [
    { title: "Relacionamento — Casal Magnético",      url: `${R2}/dr_relacionamento_seducao/placeholder.mp4` },
    { title: "Sedução — Confiança & Atração",         url: `${R2}/dr_relacionamento_seducao/placeholder_02.mp4` },
  ],

  // ── Tradicional & Creators ─────────────────────────────────────────────────
  trad_imobiliario: [
    { title: "Imobiliário — Drone Casa de Luxo",      url: `${R2}/trad_imobiliario/placeholder.mp4` },
    { title: "Imobiliário — Sala Ampla Cinemática",   url: `${R2}/trad_imobiliario/placeholder_02.mp4` },
  ],
  trad_corporativo: [
    { title: "Corporativo — Sala de Reunião Premium", url: `${R2}/trad_corporativo/placeholder.mp4` },
    { title: "Corporativo — Aperto de Mão Negócio",  url: `${R2}/trad_corporativo/placeholder_02.mp4` },
  ],
  trad_local_food: [
    { title: "Food Local — Balcão Acolhedor",         url: `${R2}/trad_local_food/placeholder.mp4` },
    { title: "Food Local — Ambiente do Restaurante",  url: `${R2}/trad_local_food/placeholder_02.mp4` },
  ],
  creator_podcast: [
    { title: "Podcast — Estúdio Cinemático",          url: `${R2}/creator_podcast/placeholder.mp4` },
    { title: "Podcast — Microfone Detalhe Bokeh",     url: `${R2}/creator_podcast/placeholder_02.mp4` },
  ],
  creator_vlog: [
    { title: "Vlog — Lifestyle Câmera na Mão",        url: `${R2}/creator_vlog/placeholder.mp4` },
    { title: "Vlog — Dia a Dia Autêntico",            url: `${R2}/creator_vlog/placeholder_02.mp4` },
  ],

  // ── Eventos & E-commerce ───────────────────────────────────────────────────
  social_wedding: [
    { title: "Casamento — Slow Motion Cinemático",    url: `${R2}/social_wedding/placeholder.mp4` },
    { title: "Casamento — Casal Hora Dourada",        url: `${R2}/social_wedding/placeholder_02.mp4` },
  ],
  ecom_beauty: [
    { title: "Beauty — Produto Macro Cinemático",     url: `${R2}/ecom_beauty/placeholder.mp4` },
    { title: "Beauty — Textura Skincare Close",       url: `${R2}/ecom_beauty/placeholder_02.mp4` },
  ],
  ecom_food_porn: [
    { title: "Food Porn — Hero Shot Macro",           url: `${R2}/ecom_food_porn/placeholder.mp4` },
    { title: "Food Porn — Detalhe Slow Mo Cozinha",   url: `${R2}/ecom_food_porn/placeholder_02.mp4` },
  ],

};
