import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AUDIO_VAULT } from "@/app/lib/audioVault";
import { getVaultVideos } from "@/app/lib/videoVault";
import { findMusicTracks } from "@/app/lib/musicSearch";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), route: "generate", event, ...data }));

// ─── Formatos que usam orientação Portrait (9:16) ─────────────────────────────
const PORTRAIT_FORMATS = ["creative_ad", "social_organic"];

// ─── Mapa de Ritmo por Formato ────────────────────────────────────────────────
const RHYTHM_MAP: Record<string, string> = {
  creative_ad:
    "ULTRA-RÁPIDO. Cada cena: 2-3s máximo. Frases curtíssimas, impacto imediato, cuts agressivos. Uma ideia por cena. Sem enrolação.",
  vsl_long:
    "LENTO E EMOCIONAL. Cada cena: 5-10s. Construção progressiva de tensão. Frases completas e narrativas. Storytelling profundo com pausas dramáticas.",
  social_organic:
    "DINÂMICO E CASUAL. Cada cena: 3-4s. Visual autêntico, relatable, dia a dia real. Trending e lifestyle. Sem exagero corporativo.",
  corporate_brand:
    "PROFISSIONAL E LIMPO. Cada cena: 4-6s. Estética premium e institucional. Visuals de qualidade, sem excessos. Tom sério e confiável.",
  cinematic:
    "ÉPICO E FLUIDO. Cada cena: 6-12s. Planos abertos, movimento de câmera lento e elegante. Atmosfera cinematográfica total. Cada cena é um quadro.",
};

// ─── Mapa Visual por Nicho ────────────────────────────────────────────────────
const VISUAL_MAP: Record<string, { label: string; keywords: string[]; style: string }> = {
  dr_bizopp:       { label: "Renda Extra / BizOpp",     keywords: ["counting money", "luxury lifestyle", "stock chart going up", "laptop income", "cash pile", "financial freedom"],                           style: "aspiracional, luxo acessível, sucesso financeiro" },
  dr_nutra_weight: { label: "Emagrecimento",             keywords: ["fat loss transformation", "measuring tape waist", "healthy salad bowl", "before after body", "slim waist woman"],                         style: "transformação física, saúde, corpo ideal" },
  dr_nutra_pain:   { label: "Dores Articulares",         keywords: ["x-ray knee joint", "knee inflammation closeup", "elderly person pain", "spine anatomy", "joint pain relief massage"],                     style: "médico-clínico, dor e alívio, esperança" },
  dr_nutra_vision: { label: "Visão",                     keywords: ["eye closeup macro", "blurry vision effect", "reading glasses elderly", "eye anatomy diagram", "vision test chart"],                       style: "oftalmológico, foco, clareza visual" },
  dr_nutra_brain:  { label: "Memória / Cognição",        keywords: ["brain anatomy 3d", "neuron synapse glow", "memory focus concept", "thinking person frustrated", "cognitive performance"],                  style: "neurológico, foco mental, inteligência" },
  dr_nutra_mens:   { label: "Saúde Masculina",           keywords: ["strong man gym", "masculine vitality sport", "confident man portrait", "testosterone strength", "male fitness training"],                  style: "masculinidade, força, vitalidade, confiança" },
  dr_blood_sugar:  { label: "Glicemia / Diabetes",       keywords: ["blood glucose test meter", "diabetic healthy food", "sugar crystal macro", "medical test strips", "healthy eating diabetes"],             style: "médico, controle glicêmico, saúde preventiva" },
  dr_survival:     { label: "Sobrevivência",             keywords: ["wilderness survival skills", "emergency food supply", "off grid bunker", "natural disaster storm", "prepper gear outdoor"],               style: "tensão, preparação, autodefesa, urgência" },
  dr_manifestation:{ label: "Espiritualidade",           keywords: ["meditation nature sunset", "spiritual awakening light", "cosmic universe stars", "law of attraction vision board", "zen person peace"],   style: "espiritual, paz interior, abundância, cosmos" },
  trad_real_estate:{ label: "Imobiliário / Loteamento",  keywords: ["aerial drone luxury house", "modern architecture exterior", "spacious luxury living room", "real estate keys", "luxury home pool sunset"], style: "premium, aspiracional, lifestyle sofisticado" },
  trad_corporate:  { label: "Corporativo / B2B",         keywords: ["business meeting boardroom", "modern glass office", "handshake deal professional", "corporate team collaboration", "executive portrait"],  style: "profissional, confiança, resultado, solidez" },
  trad_local_biz:  { label: "Negócios Locais",           keywords: ["small business owner shop", "customer service smile", "local storefront", "entrepreneur working", "community neighborhood"],               style: "proximidade, humanizado, confiança local" },
  trad_fitness:    { label: "Fitness / Saúde",           keywords: ["gym workout intense", "personal trainer athlete", "healthy lifestyle active", "sports performance", "fitness motivation"],                 style: "energia, transformação, performance atlética" },
  trad_education:  { label: "Educação / Infoproduto",    keywords: ["online learning laptop", "student studying focused", "digital classroom modern", "knowledge books desk", "e-learning course interface"],   style: "inspirador, crescimento, aprendizado, futuro" },
};

// ─── Regra de Áudio por combinação Format × Theme ────────────────────────────
function getAudioRule(videoFormat: string, videoTheme: string): string {
  const isDR      = videoTheme.startsWith("dr_");
  const isVSL     = videoFormat === "vsl_long";
  const isCinema  = videoFormat === "cinematic";
  const isCorp    = videoFormat === "corporate_brand";
  const isSocial  = videoFormat === "social_organic";

  if (isVSL && isDR)
    return `Retorne music_style = "vsl_tension" (COFRE PREMIUM). VSL de Direct Response exige máxima tensão psicológica e urgência.`;
  if ((videoFormat === "creative_ad" || isVSL) && videoTheme === "dr_bizopp")
    return `Retorne music_style = "extra_income_hype" (COFRE PREMIUM). Conteúdo de renda extra exige energia alta e aspiração financeira.`;
  if (isCinema && videoTheme === "trad_real_estate")
    return `Retorne music_style = "real_estate_cinematic" (COFRE PREMIUM). Imobiliário cinematográfico exige épico sofisticado.`;
  if (isCorp)
    return `Use termos como "clean corporate ambient", "minimal tech background", "professional piano instrumental". Tom limpo e institucional. NUNCA tensão ou hype.`;
  if (isSocial)
    return `Use termos como "lo-fi hip hop chill", "upbeat indie pop background", "trendy electronic beat". Energia casual e moderna.`;
  if (isCinema)
    return `Use termos como "epic orchestral score", "cinematic swell dramatic", "emotional strings". Grandiosidade e emoção pura.`;
  if (isDR)
    return `Use termos de tensão em inglês: "dark synthwave", "ticking clock tension", "deep bass drone", "suspense pulse". NUNCA músicas felizes, ukulele ou corporativas.`;
  return `Escolha music_style adequado ao tom do roteiro. Use termos em inglês precisos e buscáveis no Pixabay.`;
}

// ─── Builder do System Prompt ─────────────────────────────────────────────────
function buildSystemPrompt(videoFormat: string, videoTheme: string): string {
  const rhythm = RHYTHM_MAP[videoFormat] ?? RHYTHM_MAP["vsl_long"];
  const visual = VISUAL_MAP[videoTheme];
  const audioRule = getAudioRule(videoFormat, videoTheme);

  const visualBlock = visual
    ? `
🎯 ══════════════════════════════════════════════════════════════ 🎯
   VOCABULÁRIO VISUAL — NICHO: ${visual.label.toUpperCase()}

   Para broll_search_keywords, PRIORIZE estas keywords (em inglês):
   ${visual.keywords.map((k) => `"${k}"`).join(" · ")}

   Estilo visual esperado: ${visual.style}

   ✅ BOAS keywords: concretas, literais, buscáveis no banco de imagens
   ❌ RUINS: "success" (vago) · "growth" (abstrato) · "happiness" (genérico)
   ✅ Exemplos certos: "x-ray knee joint" · "aerial drone luxury house"
🎯 ══════════════════════════════════════════════════════════════ 🎯`
    : "";

  return `Você é um Diretor de Arte e Estrategista de Retenção de elite, especializado em produção de vídeo para Direct Response, mercado tradicional e criadores de conteúdo. Ao ler a copy, analise o nicho e o gatilho emocional para entregar o mapa de edição mais preciso e persuasivo possível.

⚠️ ══════════════════════════════════════════════════════════════ ⚠️
   REGRA ABSOLUTA: PROCESSE 100% DO TEXTO ENVIADO.
   NÃO RESUMA, NÃO ENCURTE, NÃO PULE NENHUMA FRASE.
   FATIE O ROTEIRO DO INÍCIO AO FIM SEM EXCEÇÃO.
⚠️ ══════════════════════════════════════════════════════════════ ⚠️

⏱️ ══════════════════════════════════════════════════════════════ ⏱️
   REGRA DE RITMO — FORMATO SELECIONADO: ${videoFormat.toUpperCase()}
   ${rhythm}
   Aplique este ritmo a TODAS as cenas. O formato define a respiração do vídeo.
⏱️ ══════════════════════════════════════════════════════════════ ⏱️
${visualBlock}

🎵 ══════════════════════════════════════════════════════════════ 🎵
   REGRA DE ÁUDIO
   ${audioRule}
🎵 ══════════════════════════════════════════════════════════════ 🎵

🔐 ══════════════════════════════════════════════════════════════ 🔐
   COFRE DE ÁUDIO PREMIUM — se aplicável, retorne EXATAMENTE:
   • "vsl_tension"            → VSLs e anúncios de urgência/tensão
   • "extra_income_hype"      → Renda extra, bizzopp, motivacional
   • "real_estate_cinematic"  → Imóveis e lifestyle premium
   Caso contrário, retorne termos em inglês para busca no Pixabay.
🔐 ══════════════════════════════════════════════════════════════ 🔐

🎬 ══════════════════════════════════════════════════════════════ 🎬
   ACERVO PREMIUM DE VÍDEO (Kraft Mídia) — vault_category por cena

   Para CADA cena, retorne vault_category com a chave EXATA abaixo
   que melhor represente o visual e o gatilho emocional daquela cena.
   Retorne null apenas se NENHUMA categoria encaixar de forma relevante.

   🎣 GANCHOS — Pattern Interrupt (Primeiros 3 segundos):
      hook_dr_choque · hook_financas_hype · hook_trad_dinamico

   💊 DR & INFO — Foco em Conversão:
      dr_nutra_dores · dr_nutra_emagrecimento · dr_nutra_cerebro
      dr_financas_indenizacoes · dr_financas_renda_extra
      dr_relacionamento_seducao

   🏠 TRADICIONAL & CREATORS:
      trad_imobiliario · trad_corporativo · trad_local_food
      creator_podcast · creator_vlog

   🎉 EVENTOS & E-COMMERCE:
      social_wedding · ecom_beauty · ecom_food_porn

   ⚡ REGRA DE OURO — RETENÇÃO OBRIGATÓRIA:
      Na CENA 1 (primeiros 3 segundos) ou em qualquer momento de quebra de padrão
      ou revelação no meio da copy, PRIORIZE obrigatoriamente uma categoria hook_...
      para gerar um pattern interrupt e prender a atenção do espectador.

   🧠 EXEMPLOS DE RACIOCÍNIO:
      • Copy menciona "dinheiro esquecido pelo governo", "acordos" ou "selos oficiais"
        → use dr_financas_indenizacoes (público 45-60 anos, autoridade, vitória legal)
      • Copy menciona "dores nas articulações", "joelho" ou "inflamação"
        → use dr_nutra_dores
      • Copy de revelação financeira com urgência no início
        → use hook_financas_hype na Cena 1, depois dr_financas_renda_extra
      • Copy institucional com abertura dinâmica
        → use hook_trad_dinamico na Cena 1
🎬 ══════════════════════════════════════════════════════════════ 🎬

REGRAS GERAIS:
1. broll_search_keywords: INGLÊS · máximo 3 palavras · CONCRETAS e LITERAIS.
2. sound_effect: descrição em inglês do efeito sonoro ideal para o corte.
3. text_animation: descreva em PT-BR o estilo de animação do texto na tela.
4. vault_category: chave EXATA do Acervo de Vídeo ou null.
5. Responda APENAS neste formato JSON (sem texto fora do JSON):
{
  "project_vibe": "descrição do tom geral do projeto em PT-BR",
  "music_style": "categoria do cofre OU termo inglês para Pixabay",
  "scenes": [
    {
      "segment": "Hook|Body|CTA",
      "text_chunk": "trecho exato do roteiro",
      "visual_idea": "descrição da ideia visual em PT-BR",
      "broll_search_keywords": "english keywords max 3 words",
      "sound_effect": "english sfx description",
      "text_animation": "descrição PT-BR da animação de texto",
      "vault_category": "chave_do_vault ou null"
    }
  ]
}`;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const {
      copy,
      videoFormat = "vsl_long",
      videoTheme  = "dr_bizopp",
    } = await req.json();

    if (!copy || typeof copy !== "string" || copy.trim().length === 0) {
      return NextResponse.json(
        { error: "O campo 'copy' é obrigatório e não pode estar vazio." },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(videoFormat, videoTheme);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Aqui está a copy do vídeo para você decupar:\n\n${copy.trim()}`,
        },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "A IA não retornou conteúdo." }, { status: 500 });
    }

    const parsed = JSON.parse(raw);

    // ── Cronômetro de Retenção ────────────────────────────────────────────────
    if (Array.isArray(parsed.scenes)) {
      for (const scene of parsed.scenes) {
        const words = String(scene.text_chunk ?? "").trim().split(/\s+/).filter(Boolean).length;
        scene.estimated_duration_seconds = Math.round((words / 2.5) * 10) / 10;
      }
    }

    // ── Cofre de Vídeo (DB override + static fallback) ───────────────────────
    const videoVaultMap = await getVaultVideos();

    // ── Trilhas: Cofre Privado + Jamendo/Freesound sempre em paralelo ────────
    const vaultKey    = String(parsed.music_style ?? "").trim().toLowerCase();
    const style       = String(parsed.music_style ?? "").trim();

    // Vault: só URLs reais hospedadas (sem placeholders locais)
    const vaultTracks = (AUDIO_VAULT[vaultKey] ?? []).filter(
      t => t.url.startsWith("http") && !t.url.includes("placeholder")
    );

    // Sempre busca Jamendo/Freesound — independente de ter vault ou não
    const musicTracks = await findMusicTracks(style, 5);
    log("music_tracks", { style, count: musicTracks.length, sources: musicTracks.map(t => t.source) });

    // Merge: vault primeiro (marcado como premium), depois curadas por IA
    const seen = new Set<string>();
    const merged: { url: string; title: string; is_premium_vault: boolean }[] = [];

    for (const t of vaultTracks) {
      if (!seen.has(t.url)) { seen.add(t.url); merged.push({ url: t.url, title: t.title, is_premium_vault: true }); }
    }
    for (const t of musicTracks) {
      if (!seen.has(t.url) && merged.length < 5) {
        seen.add(t.url);
        merged.push({ url: t.url, title: `${t.title} — ${t.artist}`, is_premium_vault: false });
      }
    }

    const musicQuery = encodeURIComponent(style || "cinematic");
    parsed.pixabay_search_url = `https://www.jamendo.com/search?q=${musicQuery}`;
    parsed.background_tracks  = merged.length
      ? merged
      : [{ url: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title: "Epic Orchestral Cinematic", is_premium_vault: true }];

    // ── Pexels + Pixabay + Freesound em paralelo por cena ────────────────────
    const orientation = PORTRAIT_FORMATS.includes(videoFormat) ? "portrait" : "landscape";

    if (Array.isArray(parsed.scenes)) {
      await Promise.all(
        parsed.scenes.map(async (scene: Record<string, unknown>) => {
          await Promise.all([

            // ── Pexels + Pixabay: até 4 opções de vídeo HD ───────────────────
            (async () => {
              const keyword = String(scene.broll_search_keywords ?? "");
              try {

                // Busca Pexels e Pixabay em paralelo
                const [pexelsRes, pixabayRes] = await Promise.all([
                  fetch(
                    `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=3&orientation=${orientation}`,
                    { headers: { Authorization: process.env.PEXELS_API_KEY ?? "" } }
                  ).catch(() => null),
                  fetch(
                    `https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&per_page=3&orientation=${orientation === "portrait" ? "vertical" : "horizontal"}&safesearch=true`
                  ).catch(() => null),
                ]);

                const options: { url: string; source: string }[] = [];

                // ── Pexels ───────────────────────────────────────────────────
                if (pexelsRes?.ok) {
                  const data = await pexelsRes.json();
                  const videos: Array<{ video_files: Array<{ quality: string; width: number; link: string }> }> =
                    data?.videos ?? [];
                  for (const video of videos) {
                    const files = video.video_files ?? [];
                    const hd =
                      files.find((f) => f.quality === "hd" && f.width >= 1280) ??
                      files.sort((a: { width: number }, b: { width: number }) => b.width - a.width)[0];
                    if (hd?.link) options.push({ url: hd.link, source: "Pexels" });
                  }
                }

                // ── Pixabay ──────────────────────────────────────────────────
                if (pixabayRes?.ok) {
                  const data = await pixabayRes.json();
                  type PixabayVideo = { videos: Record<string, { url: string; width: number }> };
                  const hits: PixabayVideo[] = data?.hits ?? [];
                  for (const hit of hits) {
                    const videos = hit.videos ?? {};
                    // Preferência: large (1280p) → medium (960p) → small (640p)
                    const best =
                      (videos.large?.url  ? videos.large  : null) ??
                      (videos.medium?.url ? videos.medium : null) ??
                      (videos.small?.url  ? videos.small  : null);
                    if (best?.url) options.push({ url: best.url, source: "Pixabay" });
                  }
                }

                if (options.length) {
                  scene.video_options = options;
                  scene.video_url     = options[0].url;
                  log("video_hit", { keyword, count: options.length });
                } else {
                  log("video_miss", { keyword });
                }
                scene.pexels_search_url =
                  `https://www.pexels.com/pt-br/procurar/videos/${encodeURIComponent(keyword)}/`;
              } catch (e) { log("video_error", { keyword, error: String(e) }); }
            })(),

            // ── Freesound: até 2 opções de SFX ────────────────────────────────
            (async () => {
              try {
                const query = String(scene.sound_effect ?? "");
                const res = await fetch(
                  `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews&page_size=2&filter=duration:[0+TO+15]`,
                  { headers: { Authorization: `Token ${process.env.FREESOUND_KEY}` } }
                );
                if (!res.ok) return;
                const data = await res.json();
                const results: Array<{ previews: Record<string, string> }> = data?.results ?? [];

                const sfxOptions: string[] = results
                  .map((r) => r.previews?.["preview-hq-mp3"])
                  .filter(Boolean);

                if (sfxOptions.length) {
                  scene.sfx_options = sfxOptions;
                  scene.sfx_url     = sfxOptions[0];
                }
                scene.freesound_search_url =
                  `https://freesound.org/search/?q=${encodeURIComponent(query)}`;
              } catch { /* falha silenciosa */ }
            })(),

          ]);

          // ── Acervo Premium de Vídeo: injecta ANTES dos resultados Pexels ──
          const vaultKey    = String(scene.vault_category ?? "").trim().toLowerCase();
          // Filter out placeholder URLs — only inject real hosted videos
          const vaultVideos = (videoVaultMap[vaultKey] ?? []).filter(
            v => v.url.startsWith("http") && !v.url.includes("placeholder")
          );
          if (vaultVideos.length) {
            const vaultOpts = vaultVideos.map((v) => ({ url: v.url, source: "Premium Vault" }));
            const existing  = Array.isArray(scene.video_options) ? scene.video_options : [];
            scene.video_options = [...vaultOpts, ...existing];
            scene.video_url     = vaultOpts[0].url;
          }
        })
      );
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("[generate] Erro:", err);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Erro ao processar a resposta da IA. Tente novamente." },
        { status: 500 }
      );
    }
    const message = err instanceof Error ? err.message : "Erro interno do servidor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
