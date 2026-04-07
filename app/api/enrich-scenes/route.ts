// ─── /api/enrich-scenes ──────────────────────────────────────────────────────
// Recebe a transcrição REAL do Whisper e gera cenas inteligentes com:
//   1. GPT-4o-mini → extrai contexto do vídeo (nicho, produto, promessa)
//   2. GPT-4o → análise emocional + 4 search queries cinematográficas
//   3. Pexels + Pixabay SIMULTÂNEOS → até 12 B-rolls por cena, sem repetição
//   4. Freesound → SFX de impacto
//   5. Jamendo → Pixabay Music → vault (hierarquia de qualidade para trilhas)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Prompts ──────────────────────────────────────────────────────────────────

const CONTEXT_PROMPT = `Analise a transcrição e extraia o contexto de marketing. Retorne APENAS JSON:
{
  "niche": "finanças|saúde|emagrecimento|imobiliário|relacionamento|digital|jurídico|outro",
  "product": "nome/descrição curta do produto ou serviço (máx 10 palavras)",
  "mainPromise": "promessa principal da copy (máx 15 palavras)",
  "targetAudience": "público-alvo principal (máx 10 palavras)",
  "vslStyle": "ugc|formal|depoimento|educational"
}`;

const SCENE_PROMPT = (ctx: string) => `Você é um Diretor de Arte cinematográfico sênior especializado em Direct Response de alto volume. Você trabalha com transcrições reais de vídeos UGC e pensa visualmente com precisão de DOP.

CONTEXTO DO VÍDEO:
${ctx}

Sua tarefa: quebrar a transcrição em cenas de 4–7 segundos com queries visuais CINEMATOGRÁFICAS.

═══════════════════════════════════════════════
REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. PROCESSE 100% DA TRANSCRIÇÃO. Cada palavra deve aparecer em algum textSnippet.
2. textSnippet: trecho EXATO da transcrição, na ordem original.
3. duration: USE OS TIMESTAMPS WHISPER para calcular a duração real. Mínimo: 3.5s · Máximo: 8.0s
4. emotion: EXATAMENTE um dos valores:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
5. searchQueries: QUATRO queries com ângulos COMPLETAMENTE DIFERENTES:
   - Query 1: PESSOA + ação + emoção (sujeito concreto + verbo + expressão)
   - Query 2: AMBIENTE / CENÁRIO + luz/atmosfera
   - Query 3: OBJETO / DETALHE macro (close-up extremo)
   - Query 4: METÁFORA VISUAL cinematográfica (abstrato/simbólico)
   USE O CONTEXTO DO NICHO:
   FINANÇAS: "frustrated man bills kitchen table" / "dark office desk overdue notices" / "empty wallet macro" / "storm clouds time lapse"
   SAÚDE: "person pain grimacing closeup" / "hospital room moody light" / "pill bottle macro" / "cells microscope abstract"
   EMAGRECIMENTO: "woman measuring waist frustrated" / "scale morning light kitchen" / "salad fork plate macro" / "butterfly timelapse metamorphosis"
   IMOBILIÁRIO: "couple keys new house door" / "aerial luxury suburb drone" / "marble countertop macro" / "sunrise cityscape skyline"
   RELACIONAMENTO: "couple arguing kitchen night" / "lonely window rain exterior" / "wedding ring bokeh" / "bridge sunrise hope abstract"
   DIGITAL/RENDA: "person laptop multiple screens home" / "smartphone earning notification" / "money transfer digital abstract" / "coffee shop freedom laptop"
   JURÍDICO: "lawyer documents signing closeup" / "courtroom empty gavel" / "contract pen macro" / "scales justice balance"
6. suggestedSfx: EXATAMENTE um valor ou null:
   "riser" · "impact" · "glitch" · "cash_register" · "heartbeat" · "bell" · "whoosh" · "tension_sting" · null
7. musicMood: EXATAMENTE um valor:
   "dark_tension" · "emotional_hope" · "epic_cinematic" · "urgent_pulse" · "mysterious_ambient" · "triumphant" · "melancholic"

Retorne APENAS JSON:
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "trecho exato aqui",
      "duration": 4.5,
      "emotion": "Dor",
      "searchQueries": [
        "woman crying frustrated bills kitchen table",
        "dark kitchen table overdue notices moody light",
        "empty wallet credit card declined macro closeup",
        "storm clouds time lapse dark horizon abstract"
      ],
      "suggestedSfx": "tension_sting",
      "musicMood": "dark_tension"
    }
  ]
}`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PexelsFile  { quality: string; width: number; link: string; }
interface PexelsVideo { image: string; video_files: PexelsFile[]; }
interface PixabayHit  { videos: { large?: { url: string }; medium?: { url: string } }; userImageURL: string; }
interface VideoOpt    { url: string; thumb: string; query: string; }

interface EnrichedScene {
  id: string; textSnippet: string; duration: number;
  emotion: string; musicMood?: string; searchQueries: string[]; suggestedSfx: string | null;
  videoUrl?: string | null; thumbUrl?: string | null;
  sfxPreviewUrl?: string | null; videoOptions?: VideoOpt[];
}

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

const R2_MUSIC = "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3";

// ─── Music mood map (matches generate-timeline) ───────────────────────────────
const MUSIC_MOOD_MAP: Record<string, { pixabayQueries: string[]; jamendoTags: string; jamendoSpeed: string; fallbackUrl: string; title: string }> = {
  dark_tension:       { pixabayQueries: ["dark tension suspense", "horror ambient drone", "dark cinematic thriller"], jamendoTags: "dark+ambient+tension",     jamendoSpeed: "low",     fallbackUrl: R2_MUSIC, title: "Dark Tension" },
  emotional_hope:     { pixabayQueries: ["emotional piano hope", "inspirational cinematic strings", "heartfelt orchestral"], jamendoTags: "emotional+inspirational+piano", jamendoSpeed: "medium",  fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", title: "Emotional Hope" },
  epic_cinematic:     { pixabayQueries: ["epic orchestral cinematic", "powerful dramatic score", "cinematic epic trailer"], jamendoTags: "epic+cinematic+orchestral",     jamendoSpeed: "high",    fallbackUrl: R2_MUSIC, title: "Epic Cinematic" },
  urgent_pulse:       { pixabayQueries: ["urgent electronic pulse", "ticking tension electronic", "fast paced dark electronic"], jamendoTags: "electronic+dark+urgent",   jamendoSpeed: "high",    fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", title: "Urgent Pulse" },
  mysterious_ambient: { pixabayQueries: ["mysterious ambient dark", "eerie atmospheric", "cinematic mystery ambient"], jamendoTags: "ambient+mysterious+dark",    jamendoSpeed: "verylow", fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", title: "Mysterious Ambient" },
  triumphant:         { pixabayQueries: ["triumphant success victory", "uplifting motivational", "powerful success anthem"], jamendoTags: "uplifting+motivational+triumph", jamendoSpeed: "high",  fallbackUrl: R2_MUSIC, title: "Triumphant" },
  melancholic:        { pixabayQueries: ["melancholic sad piano", "emotional sad background", "melancholy ambient strings"], jamendoTags: "melancholic+sad+piano",     jamendoSpeed: "low",     fallbackUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", title: "Melancholic" },
};
const EMOTION_TO_MOOD: Record<string, string> = {
  Dor:"dark_tension", Choque:"dark_tension", Urgência:"urgent_pulse", Mistério:"mysterious_ambient",
  Gancho:"dark_tension", Revelação:"epic_cinematic", Esperança:"emotional_hope",
  Oportunidade:"triumphant", Vantagem:"triumphant", CTA:"urgent_pulse", "Prova Social":"emotional_hope",
};

// ─── Media helpers ────────────────────────────────────────────────────────────

async function fetchPexels(query: string, key: string, perPage = 3): Promise<VideoOpt[]> {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&min_width=1280`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.videos ?? []) as PexelsVideo[]).flatMap(video => {
      const files = video.video_files ?? [];
      const hd = files.find(f => f.quality === "hd" && f.width >= 1920)
              ?? files.find(f => f.quality === "hd" && f.width >= 1280)
              ?? files.find(f => f.quality === "hd")
              ?? files.slice().sort((a, b) => b.width - a.width)[0];
      if (!hd?.link) return [];
      return [{ url: hd.link, thumb: video.image ?? "", query }];
    });
  } catch { return []; }
}

async function fetchPixabay(query: string, key: string, perPage = 3): Promise<VideoOpt[]> {
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=${perPage}&video_type=film&min_width=1280`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.hits ?? []) as PixabayHit[]).flatMap(hit => {
      const url = hit.videos?.large?.url ?? hit.videos?.medium?.url;
      if (!url) return [];
      return [{ url, thumb: hit.userImageURL ?? "", query }];
    });
  } catch { return []; }
}

async function fetchPixabayMusic(query: string, key: string): Promise<{ url: string; title: string } | null> {
  try {
    const res = await fetch(`https://pixabay.com/api/music/?key=${key}&q=${encodeURIComponent(query)}&per_page=3`);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = ((data?.hits ?? []) as Array<{ audio: string; title: string }>).find(h => h.audio);
    return hit ? { url: hit.audio, title: hit.title ?? query } : null;
  } catch { return null; }
}

async function fetchJamendoMusic(tags: string, speed: string, clientId: string): Promise<{ url: string; title: string } | null> {
  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=3` +
      `&tags=${encodeURIComponent(tags)}&speed=${speed}&audioformat=mp32`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const t = ((data?.results ?? []) as Array<{ audio: string; name: string; artist_name: string }>).find(r => r.audio);
    return t ? { url: t.audio, title: `${t.name} — ${t.artist_name}` } : null;
  } catch { return null; }
}

// ─── POST handler ─────────────────────────────────────────────────────────────
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
    const { text, words, videoDuration } = body as {
      text?: string;
      words?: Array<{ word: string; start: number; end: number }>;
      videoDuration?: number;
    };

    if (!text?.trim())
      return NextResponse.json({ error: "Campo 'text' (transcrição) é obrigatório." }, { status: 400 });

    // ── Stage 1: Extrair contexto do vídeo (rápido, mini) ─────────────────
    let contextStr = "";
    try {
      const ctxCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CONTEXT_PROMPT },
          { role: "user",   content: text.slice(0, 800) },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });
      const ctx = JSON.parse(ctxCompletion.choices[0]?.message?.content ?? "{}");
      contextStr = [
        `Nicho: ${ctx.niche ?? "não identificado"}`,
        `Produto: ${ctx.product ?? "não identificado"}`,
        `Promessa: ${ctx.mainPromise ?? "não identificada"}`,
        `Público: ${ctx.targetAudience ?? "não identificado"}`,
        `Estilo: ${ctx.vslStyle ?? "ugc"}`,
      ].join("\n");
    } catch { /* continua sem contexto */ }

    // ── Stage 2: GPT-4o — análise semântica com contexto ─────────────────
    const userMsg = words?.length
      ? `Transcrição Whisper do vídeo UGC (${Math.round(videoDuration ?? 60)}s).\n\nTexto:\n${text}\n\nTimestamps:\n${words.slice(0, 200).map(w => `[${w.start.toFixed(1)}s-${w.end.toFixed(1)}s] ${w.word}`).join(", ")}`
      : `Transcrição do vídeo (${Math.round(videoDuration ?? 60)}s):\n\n${text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SCENE_PROMPT(contextStr || "Contexto não disponível") },
        { role: "user",   content: userMsg },
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

    // ── Normalize ─────────────────────────────────────────────────────────
    const VALID_EMOTIONS = new Set([
      "Revelação","Urgência","Choque","Dor","Esperança",
      "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
    ]);
    const VALID_SFX   = new Set(Object.keys(SFX_TO_FREESOUND));
    const VALID_MOODS = new Set(Object.keys(MUSIC_MOOD_MAP));

    type RawScene = Record<string, unknown>;
    const scenes: EnrichedScene[] = (rawScenes as RawScene[]).map((sc, i) => {
      const snippet    = String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? "").trim();
      const wc         = snippet.split(/\s+/).filter(Boolean).length;
      const rawEmotion = String(sc.emotion ?? "Gancho");
      const rawSfx     = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawMood    = String(sc.musicMood ?? "");
      const rawQ       = Array.isArray(sc.searchQueries) ? sc.searchQueries
                       : Array.isArray(sc.searchKeywords) ? sc.searchKeywords : [];
      const emotion    = VALID_EMOTIONS.has(rawEmotion) ? rawEmotion : "Gancho";
      return {
        id:           String(sc.id ?? `drs-${i}`),
        textSnippet:  snippet,
        duration:     typeof sc.duration === "number"
          ? Math.max(3.5, Math.min(8.0, sc.duration))
          : Math.max(3.5, Math.min(8.0, Math.round((wc / 2.2) * 10) / 10)),
        emotion,
        musicMood:    VALID_MOODS.has(rawMood) ? rawMood : (EMOTION_TO_MOOD[emotion] ?? "dark_tension"),
        searchQueries:(rawQ as unknown[]).slice(0, 4).map(String),
        suggestedSfx: rawSfx !== null && VALID_SFX.has(String(rawSfx)) ? String(rawSfx) : null,
      };
    });

    // ── Stage 3: Media + Music enrichment ─────────────────────────────────
    const PEXELS_KEY    = process.env.PEXELS_API_KEY    ?? "";
    const PIXABAY_KEY   = process.env.PIXABAY_API_KEY   ?? "";
    const FREESOUND_KEY = process.env.FREESOUND_KEY     ?? "";
    const JAMENDO_ID    = process.env.JAMENDO_CLIENT_ID ?? "";

    const usedUrls = new Set<string>();

    await Promise.all(scenes.map(async (scene) => {
      await Promise.all([

        // ── DUAL-SOURCE B-roll: Pexels + Pixabay SIMULTÂNEOS ─────────────
        (async () => {
          const queries = scene.searchQueries.slice(0, 4).filter(Boolean);
          if (!queries.length) return;

          const [pexelsResults, pixabayResults] = await Promise.all([
            PEXELS_KEY
              ? Promise.all(queries.map(q => fetchPexels(q, PEXELS_KEY)))
              : Promise.resolve(queries.map(() => [] as VideoOpt[])),
            PIXABAY_KEY
              ? Promise.all(queries.map(q => fetchPixabay(q, PIXABAY_KEY)))
              : Promise.resolve(queries.map(() => [] as VideoOpt[])),
          ]);

          const opts: VideoOpt[] = [];
          const localSeen = new Set<string>();
          const addUnique = (item: VideoOpt) => {
            if (!usedUrls.has(item.url) && !localSeen.has(item.url)) {
              localSeen.add(item.url); opts.push(item);
            }
          };
          // Safe Math.max — avoid -Infinity on empty arrays
          const allLengths = [...pexelsResults, ...pixabayResults].map(r => r.length);
          const maxLen = allLengths.length > 0 ? Math.max(...allLengths) : 0;
          for (let qi = 0; qi < queries.length; qi++) {
            for (let ri = 0; ri < maxLen; ri++) {
              if (pexelsResults[qi]?.[ri]) addUnique(pexelsResults[qi][ri]);
              if (pixabayResults[qi]?.[ri]) addUnique(pixabayResults[qi][ri]);
            }
          }

          if (opts.length) {
            scene.videoUrl     = opts[0].url;
            scene.thumbUrl     = opts[0].thumb;
            scene.videoOptions = opts.slice(0, 12);
            usedUrls.add(opts[0].url);
          }
        })(),

        // ── Freesound SFX ─────────────────────────────────────────────────
        (async () => {
          if (!FREESOUND_KEY || !scene.suggestedSfx) return;
          try {
            const sfxQ = SFX_TO_FREESOUND[scene.suggestedSfx] ?? scene.suggestedSfx;
            const res = await fetch(
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

    // ── Stage 4: Music — top 3 moods → Jamendo → Pixabay → fallback ──────
    const moodCount: Record<string, number> = {};
    for (const s of scenes) {
      const m = s.musicMood ?? EMOTION_TO_MOOD[s.emotion] ?? "dark_tension";
      moodCount[m] = (moodCount[m] ?? 0) + 1;
    }
    const topMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);

    interface MusicTrack { url: string; title: string; is_premium_vault: boolean; }
    const backgroundTracks: MusicTrack[] = [];

    await Promise.all(topMoods.map(async (mood, idx) => {
      const cfg = MUSIC_MOOD_MAP[mood] ?? MUSIC_MOOD_MAP["dark_tension"];
      let track: { url: string; title: string } | null = null;

      if (JAMENDO_ID)
        track = await fetchJamendoMusic(cfg.jamendoTags, cfg.jamendoSpeed, JAMENDO_ID);

      if (!track && PIXABAY_KEY) {
        const hits = await Promise.all(cfg.pixabayQueries.map(q => fetchPixabayMusic(q, PIXABAY_KEY)));
        track = hits.find(Boolean) ?? null;
      }

      backgroundTracks[idx] = {
        url: track?.url ?? cfg.fallbackUrl,
        title: track?.title ?? cfg.title,
        is_premium_vault: !track,
      };
    }));

    const primaryMusicUrl = backgroundTracks[0]?.url ?? R2_MUSIC;

    return NextResponse.json({
      scenes,
      backgroundMusicUrl: primaryMusicUrl,
      backgroundTracks: backgroundTracks.filter(t => t?.url),
    });

  } catch (err: unknown) {
    console.error("[enrich-scenes]", err);
    if (err instanceof SyntaxError)
      return NextResponse.json({ error: "JSON inválido da IA. Tente novamente." }, { status: 500 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}
