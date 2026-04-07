import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Prompts ──────────────────────────────────────────────────────────────────

const CONTEXT_PROMPT = `Analise o texto de copy e extraia o contexto de marketing. Retorne APENAS JSON:
{
  "niche": "finanças|saúde|emagrecimento|imobiliário|relacionamento|digital|jurídico|outro",
  "product": "nome/descrição curta do produto ou serviço (máx 10 palavras)",
  "mainPromise": "promessa principal da copy (máx 15 palavras)",
  "targetAudience": "público-alvo principal (máx 10 palavras)",
  "vslStyle": "ugc|formal|depoimento|educational"
}`;

const SCENE_PROMPT = (ctx: string) => `Você é um Diretor de Arte cinematográfico sênior especializado em Direct Response de alto volume (500+ VSLs editadas). Você pensa visualmente com a precisão de um DOP da Netflix.

CONTEXTO DO VÍDEO:
${ctx}

Sua tarefa: quebrar o texto em cenas de 3–6 segundos com queries visuais de NÍVEL CINEMATOGRÁFICO.

═══════════════════════════════════════════════
REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. PROCESSE 100% DO TEXTO. Cada palavra deve aparecer em algum textSnippet.
2. textSnippet: trecho EXATO da copy, na ordem original, sem alterações.
3. duration: (palavras ÷ 2.2) + pausa_dramática
   - pausa_dramática = 0.6s se termina com ponto final, ! ou ?
   - pausa_dramática = 0.3s se termina com ... ou vírgula marcante
   - Mínimo: 3.5s · Máximo: 9.0s · Arredonde para 1 casa decimal.
4. emotion: EXATAMENTE um dos valores:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
5. searchQueries: QUATRO queries DIFERENTES em inglês para stock footage. Cada uma com ângulo COMPLETAMENTE DIFERENTE:
   - Query 1: PESSOA + ação + emoção (sujeito concreto + verbo + expressão facial/corporal)
     Ex: "frustrated woman crying holding bills at kitchen table" / "confident man smiling laptop home office"
   - Query 2: AMBIENTE / CENÁRIO + luz/atmosfera (sem pessoa ou pessoa desfocada ao fundo)
     Ex: "dark moody office desk papers overdue bills closeup" / "bright modern kitchen morning light"
   - Query 3: OBJETO / DETALHE macro (close-up extremo de um objeto relevante)
     Ex: "stack of cash bills rotating closeup slow motion" / "glucose meter finger prick blood test macro"
   - Query 4: METÁFORA VISUAL cinematográfica (imagem abstrata ou simbólica do conceito central)
     Ex: "time lapse storm clouds dark sky transformation" / "slow motion water drop ripple surface reflection"
   USE O CONTEXTO DO NICHO para escolher queries ULTRA-ESPECÍFICAS:
   FINANÇAS: person + "counting cash" / "bank statement debt" / "gold coins macro" / "time lapse stock market screen"
   SAÚDE: person + "grimacing pain" / "hospital bed iv drip" / "pill bottle prescription macro" / "healthy cells microscope abstract"
   EMAGRECIMENTO: person + "measuring waist tape frustrated" / "empty plate fork salad" / "scale number closeup" / "butterfly metamorphosis timelapse abstract"
   IMOBILIÁRIO: person + "keys new house door" / "aerial drone luxury suburb" / "marble countertop kitchen macro" / "sunrise cityscape skyline"
   RELACIONAMENTO: person + "couple argument kitchen night" / "lonely person window rain" / "wedding rings bokeh" / "bridge over water sunrise hope"
   DIGITAL/RENDA: person + "laptop multiple screens income dashboard" / "smartphone notification earning" / "money transfer digital abstract" / "laptop coffee shop freedom"
   JURÍDICO: person + "lawyer documents courtroom" / "judge gavel wood closeup" / "contract pen signing" / "scales justice balance abstract"
6. suggestedSfx: EXATAMENTE um dos valores ou null:
   "riser" · "impact" · "glitch" · "cash_register" · "heartbeat" · "bell" · "whoosh" · "tension_sting" · null
7. musicMood: EXATAMENTE um valor que descreve o mood musical ideal para esta cena:
   "dark_tension" · "emotional_hope" · "epic_cinematic" · "urgent_pulse" · "mysterious_ambient" · "triumphant" · "melancholic"

Retorne APENAS este JSON:
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "trecho exato aqui",
      "duration": 3.6,
      "emotion": "Dor",
      "searchQueries": [
        "stressed woman crying at kitchen table unpaid bills",
        "overdue bills envelope stack dark kitchen table closeup",
        "empty wallet credit card declined macro",
        "time lapse storm clouds dark horizon abstract tension"
      ],
      "suggestedSfx": "tension_sting",
      "musicMood": "dark_tension"
    }
  ]
}`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PexelsFile  { quality: string; width: number; height: number; link: string; }
interface PexelsVideo { id: number; image: string; duration: number; video_files: PexelsFile[]; }
interface PixabayHit  { videos: { large?: { url: string; width: number; height: number }; medium?: { url: string; width: number; height: number } }; userImageURL: string; }
interface VideoOpt    { url: string; thumb: string; query: string; source: "pexels" | "pixabay"; }

interface DRScene {
  id: string; textSnippet: string; duration: number;
  emotion: string; searchQueries: string[]; suggestedSfx: string | null;
  musicMood?: string;
  videoUrl?: string | null; thumbUrl?: string | null;
  sfxPreviewUrl?: string | null; videoOptions?: VideoOpt[];
}

// ─── SFX map ──────────────────────────────────────────────────────────────────
const SFX_TO_FREESOUND: Record<string, string> = {
  riser:         "cinematic riser whoosh buildup",
  impact:        "cinematic impact hit explosion",
  glitch:        "digital glitch error computer",
  cash_register: "cash register money receipt",
  heartbeat:     "heartbeat pulse medical heart",
  bell:          "bell ding chime notification",
  whoosh:        "whoosh swipe transition air",
  tension_sting: "tension sting suspense horror",
};

// ─── Music: emotion → multi-query strategy ───────────────────────────────────
// Each entry has multiple Pixabay queries (tried in parallel) + Jamendo tags
const MUSIC_EMOTION_MAP: Record<string, {
  pixabayQueries: string[];
  jamendoTags: string;
  jamendoSpeed: "verylow" | "low" | "medium" | "high" | "veryhigh";
  fallbackUrl: string;
  title: string;
}> = {
  dark_tension: {
    pixabayQueries: ["dark tension suspense", "horror ambient drone", "dark cinematic thriller"],
    jamendoTags: "dark+ambient+tension",
    jamendoSpeed: "low",
    fallbackUrl: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3",
    title: "Dark Tension",
  },
  emotional_hope: {
    pixabayQueries: ["emotional piano hope uplifting", "inspirational cinematic strings", "heartfelt emotional orchestral"],
    jamendoTags: "emotional+inspirational+piano",
    jamendoSpeed: "medium",
    fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    title: "Emotional Hope",
  },
  epic_cinematic: {
    pixabayQueries: ["epic orchestral cinematic", "powerful dramatic score", "cinematic epic trailer"],
    jamendoTags: "epic+cinematic+orchestral",
    jamendoSpeed: "high",
    fallbackUrl: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3",
    title: "Epic Cinematic",
  },
  urgent_pulse: {
    pixabayQueries: ["urgent electronic pulse beat", "ticking tension electronic", "fast paced dark electronic"],
    jamendoTags: "electronic+dark+urgent",
    jamendoSpeed: "high",
    fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "Urgent Pulse",
  },
  mysterious_ambient: {
    pixabayQueries: ["mysterious ambient dark", "eerie atmospheric background", "cinematic mystery ambient"],
    jamendoTags: "ambient+mysterious+dark",
    jamendoSpeed: "verylow",
    fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "Mysterious Ambient",
  },
  triumphant: {
    pixabayQueries: ["triumphant success victory music", "uplifting motivational achievement", "powerful success anthem"],
    jamendoTags: "uplifting+motivational+triumph",
    jamendoSpeed: "high",
    fallbackUrl: "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3",
    title: "Triumphant",
  },
  melancholic: {
    pixabayQueries: ["melancholic sad piano solo", "emotional sad background music", "melancholy ambient strings"],
    jamendoTags: "melancholic+sad+piano",
    jamendoSpeed: "low",
    fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "Melancholic",
  },
};

// Legacy emotion → musicMood map
const EMOTION_TO_MOOD: Record<string, string> = {
  Dor:          "dark_tension",
  Choque:       "dark_tension",
  Urgência:     "urgent_pulse",
  Mistério:     "mysterious_ambient",
  Gancho:       "dark_tension",
  Revelação:    "epic_cinematic",
  Esperança:    "emotional_hope",
  Oportunidade: "triumphant",
  Vantagem:     "triumphant",
  CTA:          "urgent_pulse",
  "Prova Social":"emotional_hope",
};

// ─── Media helpers ────────────────────────────────────────────────────────────

async function fetchPexels(query: string, pexelsKey: string, perPage = 4): Promise<VideoOpt[]> {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&min_width=1280`,
      { headers: { Authorization: pexelsKey } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.videos ?? []) as PexelsVideo[]).flatMap(video => {
      const files = video.video_files ?? [];
      // Prefer 1080p HD, then any HD, then best available
      const hd = files.find(f => f.quality === "hd" && f.width >= 1920)
              ?? files.find(f => f.quality === "hd" && f.width >= 1280)
              ?? files.find(f => f.quality === "hd")
              ?? files.slice().sort((a, b) => b.width - a.width)[0];
      if (!hd?.link) return [];
      return [{ url: hd.link, thumb: video.image ?? "", query, source: "pexels" as const }];
    });
  } catch { return []; }
}

async function fetchPixabay(query: string, pixabayKey: string, perPage = 4): Promise<VideoOpt[]> {
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=${perPage}&video_type=film&min_width=1280`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.hits ?? []) as PixabayHit[]).flatMap(hit => {
      const v = hit.videos?.large ?? hit.videos?.medium;
      if (!v?.url) return [];
      return [{ url: v.url, thumb: hit.userImageURL ?? "", query, source: "pixabay" as const }];
    });
  } catch { return []; }
}

// Fetch music from Pixabay music API
async function fetchPixabayMusic(query: string, pixabayKey: string): Promise<{ url: string; title: string } | null> {
  try {
    const res = await fetch(
      `https://pixabay.com/api/music/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=3`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hits = (data?.hits ?? []) as Array<{ audio: string; title: string }>;
    const hit = hits.find(h => h.audio);
    if (!hit) return null;
    return { url: hit.audio, title: hit.title ?? query };
  } catch { return null; }
}

// Fetch music from Jamendo (free, no key needed for basic search — uses client_id)
async function fetchJamendoMusic(
  tags: string,
  speed: string,
  clientId: string
): Promise<{ url: string; title: string; artist: string } | null> {
  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=3` +
      `&tags=${encodeURIComponent(tags)}&speed=${speed}&audioformat=mp32&include=musicinfo`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data?.results ?? []) as Array<{ audio: string; name: string; artist_name: string }>;
    const track = results.find(t => t.audio);
    if (!track) return null;
    return { url: track.audio, title: track.name, artist: track.artist_name };
  } catch { return null; }
}

// ─── POST /api/generate-timeline ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Check & deduct credits ────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles").select("credits,plan").eq("id", user.id).single();
  const currentCredits = profile?.credits ?? 0;
  if (currentCredits <= 0 && profile?.plan === "free") {
    return NextResponse.json({ error: "Créditos insuficientes. Faça upgrade para continuar." }, { status: 402 });
  }
  if (currentCredits > 0) {
    await supabase.from("profiles").update({ credits: currentCredits - 1 }).eq("id", user.id);
  }

  try {
    const body = await req.json();
    const copy = typeof body?.copy === "string" ? body.copy.trim() : "";
    if (!copy)
      return NextResponse.json({ error: "O campo 'copy' é obrigatório." }, { status: 400 });

    // ── Stage 1: Extrair contexto do produto/nicho ────────────────────────────
    let contextStr = "";
    try {
      const ctxCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CONTEXT_PROMPT },
          { role: "user",   content: copy.slice(0, 800) },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });
      const ctx = JSON.parse(ctxCompletion.choices[0]?.message?.content ?? "{}");
      contextStr = [
        `Nicho: ${ctx.niche ?? "não identificado"}`,
        `Produto: ${ctx.product ?? "não identificado"}`,
        `Promessa principal: ${ctx.mainPromise ?? "não identificada"}`,
        `Público-alvo: ${ctx.targetAudience ?? "não identificado"}`,
        `Estilo: ${ctx.vslStyle ?? "ugc"}`,
      ].join("\n");
    } catch { /* continua sem contexto */ }

    // ── Stage 2: GPT-4o — quebrar em cenas com queries cinematográficas ───────
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SCENE_PROMPT(contextStr || "Contexto não disponível") },
        { role: "user",   content: `Quebre esta copy em cenas para a timeline de VSL:\n\n${copy}` },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw)
      return NextResponse.json({ error: "A IA não retornou conteúdo." }, { status: 500 });

    const parsed = JSON.parse(raw);
    const rawScenes: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scenes)
      ? parsed.scenes
      : (Object.values(parsed).find((v) => Array.isArray(v)) as unknown[] | undefined) ?? [];

    if (!rawScenes.length)
      return NextResponse.json({ error: "A IA não gerou cenas." }, { status: 500 });

    // ── Normalize scenes ──────────────────────────────────────────────────────
    const VALID_EMOTIONS = new Set([
      "Revelação","Urgência","Choque","Dor","Esperança",
      "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
    ]);
    const VALID_SFX   = new Set(Object.keys(SFX_TO_FREESOUND));
    const VALID_MOODS = new Set(Object.keys(MUSIC_EMOTION_MAP));

    type RawScene = Record<string, unknown>;
    const scenes: DRScene[] = (rawScenes as RawScene[]).map((sc, i) => {
      const wc = String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? "")
        .trim().split(/\s+/).filter(Boolean).length;
      const rawEmotion  = String(sc.emotion ?? "Gancho");
      const rawSfx      = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawMood     = String(sc.musicMood ?? "");
      const rawQ        = Array.isArray(sc.searchQueries) ? sc.searchQueries
                        : Array.isArray(sc.searchKeywords) ? sc.searchKeywords : [];
      const emotion     = VALID_EMOTIONS.has(rawEmotion) ? rawEmotion : "Gancho";
      const musicMood   = VALID_MOODS.has(rawMood) ? rawMood : (EMOTION_TO_MOOD[emotion] ?? "dark_tension");
      return {
        id:           String(sc.id ?? `drs-${i}`),
        textSnippet:  String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? ""),
        duration:     typeof sc.duration === "number"
          ? Math.max(3.5, Math.min(9.0, sc.duration))
          : Math.max(3.5, Math.min(9.0, Math.round((wc / 2.2) * 10) / 10)),
        emotion,
        musicMood,
        searchQueries:(rawQ as unknown[]).slice(0, 4).map(String),
        suggestedSfx: rawSfx !== null && VALID_SFX.has(String(rawSfx)) ? String(rawSfx) : null,
      };
    });

    // ── Stage 3: Media enrichment — DUAL SOURCE (Pexels + Pixabay in parallel) ─
    const PEXELS_KEY    = process.env.PEXELS_API_KEY   ?? "";
    const PIXABAY_KEY   = process.env.PIXABAY_API_KEY  ?? "";
    const FREESOUND_KEY = process.env.FREESOUND_KEY    ?? "";
    const JAMENDO_ID    = process.env.JAMENDO_CLIENT_ID ?? "";

    // URLs já usadas globalmente — evita B-rolls repetidos entre cenas
    const usedUrls = new Set<string>();

    await Promise.all(scenes.map(async (scene) => {
      await Promise.all([

        // ── DUAL-SOURCE B-roll: Pexels + Pixabay em paralelo ─────────────────
        (async () => {
          const queries = scene.searchQueries.slice(0, 4).filter(Boolean);
          if (!queries.length) return;

          // Busca Pexels e Pixabay SIMULTANEAMENTE para todas as queries
          const [pexelsResults, pixabayResults] = await Promise.all([
            PEXELS_KEY
              ? Promise.all(queries.map(q => fetchPexels(q, PEXELS_KEY, 3)))
              : Promise.resolve(queries.map(() => [] as VideoOpt[])),
            PIXABAY_KEY
              ? Promise.all(queries.map(q => fetchPixabay(q, PIXABAY_KEY, 3)))
              : Promise.resolve(queries.map(() => [] as VideoOpt[])),
          ]);

          // Intercalar resultados: Pexels[q1], Pixabay[q1], Pexels[q2], Pixabay[q2], ...
          const opts: VideoOpt[] = [];
          const localSeen = new Set<string>();

          const addUnique = (item: VideoOpt) => {
            if (!usedUrls.has(item.url) && !localSeen.has(item.url)) {
              localSeen.add(item.url);
              opts.push(item);
            }
          };

          // Intercalação por query (dá diversidade visual)
          const allQueryLengths = [...pexelsResults, ...pixabayResults].map(r => r.length);
          const maxPerQuery = allQueryLengths.length > 0 ? Math.max(...allQueryLengths) : 0;
          for (let qi = 0; qi < queries.length; qi++) {
            for (let ri = 0; ri < maxPerQuery; ri++) {
              if (pexelsResults[qi]?.[ri]) addUnique(pexelsResults[qi][ri]);
              if (pixabayResults[qi]?.[ri]) addUnique(pixabayResults[qi][ri]);
            }
          }

          if (opts.length) {
            scene.videoUrl     = opts[0].url;
            scene.thumbUrl     = opts[0].thumb;
            scene.videoOptions = opts.slice(0, 12); // até 12 opções por cena
            usedUrls.add(opts[0].url);
          }
        })(),

        // ── Freesound SFX ─────────────────────────────────────────────────────
        (async () => {
          if (!FREESOUND_KEY || !scene.suggestedSfx) return;
          try {
            const sfxQ = SFX_TO_FREESOUND[scene.suggestedSfx] ?? scene.suggestedSfx;
            const res  = await fetch(
              `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(sfxQ)}&token=${FREESOUND_KEY}&fields=id,name,previews&page_size=3&filter=duration:[0+TO+8]`
            );
            if (!res.ok) return;
            const data = await res.json();
            const preview = (data?.results as Array<{ previews: Record<string, string> }>)
              ?.find(r => r.previews?.["preview-hq-mp3"])
              ?.previews["preview-hq-mp3"];
            if (preview) scene.sfxPreviewUrl = preview;
          } catch { /* silent */ }
        })(),
      ]);
    }));

    // ── Stage 4: Music — multi-query parallel search → 3 distinct tracks ─────
    const emotionCount: Record<string, number> = {};
    for (const s of scenes) emotionCount[s.emotion] = (emotionCount[s.emotion] ?? 0) + 1;
    const dominantEmotion = Object.entries(emotionCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Gancho";

    // Get mood distribution (top 3 moods for background music variety)
    const moodCount: Record<string, number> = {};
    for (const s of scenes) {
      const m = s.musicMood ?? EMOTION_TO_MOOD[s.emotion] ?? "dark_tension";
      moodCount[m] = (moodCount[m] ?? 0) + 1;
    }
    const topMoods = Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([mood]) => mood);

    // Fetch 3 tracks (one per top mood) — Pixabay + Jamendo in parallel
    interface MusicTrack { url: string; title: string; is_premium_vault: boolean; }
    const backgroundTracks: MusicTrack[] = [];

    await Promise.all(topMoods.map(async (mood, idx) => {
      const moodConfig = MUSIC_EMOTION_MAP[mood] ?? MUSIC_EMOTION_MAP["dark_tension"];

      // Try Jamendo first (better quality and mood metadata), then Pixabay, then fallback
      let track: { url: string; title: string } | null = null;

      if (JAMENDO_ID) {
        track = await fetchJamendoMusic(moodConfig.jamendoTags, moodConfig.jamendoSpeed, JAMENDO_ID)
          .then(t => t ? { url: t.url, title: `${t.title} — ${t.artist}` } : null);
      }

      if (!track && PIXABAY_KEY) {
        // Try all pixabay queries for this mood in parallel, take first hit
        const pixabayHits = await Promise.all(
          moodConfig.pixabayQueries.map(q => fetchPixabayMusic(q, PIXABAY_KEY))
        );
        track = pixabayHits.find(Boolean) ?? null;
      }

      backgroundTracks[idx] = {
        url: track?.url ?? moodConfig.fallbackUrl,
        title: track?.title ?? moodConfig.title,
        is_premium_vault: !track,
      };
    }));

    // Primary background music (dominant mood of the video)
    const primaryMood  = EMOTION_TO_MOOD[dominantEmotion] ?? "dark_tension";
    const primaryConfig = MUSIC_EMOTION_MAP[primaryMood] ?? MUSIC_EMOTION_MAP["dark_tension"];
    const backgroundMusicUrl = backgroundTracks[0]?.url ?? primaryConfig.fallbackUrl;

    return NextResponse.json({
      scenes,
      backgroundMusicUrl,
      backgroundTracks: backgroundTracks.filter(t => t?.url),
    });

  } catch (err: unknown) {
    console.error("[generate-timeline]", err);
    if (err instanceof SyntaxError)
      return NextResponse.json({ error: "JSON inválido da IA. Tente novamente." }, { status: 500 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}
