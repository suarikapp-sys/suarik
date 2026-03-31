// ─── /api/enrich-scenes ──────────────────────────────────────────────────────
// Recebe a transcrição REAL do Whisper e gera cenas inteligentes com:
//   1. GPT-4o → análise emocional + search queries visuais
//   2. Pexels → B-roll HD reais para cada cena
//   3. Freesound → SFX de impacto
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Vercel Hobby = max 60s. GPT-4o + Pexels parallel fetches need time.
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompt — Art Director para transcrição de vídeo UGC ─────────────
const SYSTEM_PROMPT = `Você é um Diretor de Arte sênior de VSLs (Video Sales Letters) especializado em Direct Response.

Você vai receber a transcrição real (via Whisper) de um vídeo UGC. Sua tarefa é:
1. Quebrar o texto em CENAS de 4-7 segundos cada
2. Identificar o GATILHO EMOCIONAL de cada trecho
3. Gerar termos de busca VISUAIS em inglês para encontrar B-rolls cinematográficos
4. Sugerir efeitos sonoros de transição

═══════════════════════════════════════════════
REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. PROCESSE 100% DA TRANSCRIÇÃO. Cada palavra deve aparecer em algum textSnippet.
2. textSnippet: trecho EXATO da transcrição, na ordem original.
3. duration: baseie-se nos timestamps reais do Whisper quando disponíveis.
   Mínimo: 3.5s · Máximo: 8.0s
4. emotion: use EXATAMENTE um destes valores:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
5. searchQueries: TRÊS termos em INGLÊS para busca no Pexels. REGRA CRÍTICA:
   - Busque o CONCEITO VISUAL, não traduza literalmente.
   - Termos devem ser CONCRETOS e BUSCÁVEIS (pessoas, ações, objetos reais).
   - BOM: "woman frustrated laptop", "man celebrating money", "doctor explaining patient"
   - RUIM: "success concept", "abstract emotion", "generic business"
   - Para UGC de finanças/renda: priorize "counting money", "luxury lifestyle", "working from home"
   - Para UGC de saúde: priorize "person pain", "natural medicine", "healthy lifestyle transformation"
6. suggestedSfx: "riser" | "impact" | "glitch" | "cash_register" | "heartbeat" | "bell" | "whoosh" | "tension_sting" | null

Retorne APENAS JSON:
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "trecho exato aqui",
      "duration": 4.5,
      "emotion": "Dor",
      "searchQueries": ["woman stressed bills table", "overdue payment notice", "empty wallet worry"],
      "suggestedSfx": "tension_sting"
    }
  ]
}`;

// ─── Pexels types ───────────────────────────────────────────────────────────
interface PexelsFile  { quality: string; width: number; link: string; }
interface PexelsVideo { image: string; video_files: PexelsFile[]; }

// ─── SFX → Freesound search query mapping ──────────────────────────────────
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

// ─── Background music per emotion ───────────────────────────────────────────
const R2_MUSIC = "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3";

// ─── Enriched scene shape ───────────────────────────────────────────────────
interface EnrichedScene {
  id:             string;
  textSnippet:    string;
  duration:       number;
  emotion:        string;
  searchQueries:  string[];
  suggestedSfx:   string | null;
  videoUrl?:      string | null;
  thumbUrl?:      string | null;
  sfxPreviewUrl?: string | null;
  videoOptions?:  Array<{ url: string; thumb: string; query: string }>;
}

// ─── POST handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, words, videoDuration } = body as {
      text?: string;
      words?: Array<{ word: string; start: number; end: number }>;
      videoDuration?: number;
    };

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Campo 'text' (transcrição) é obrigatório." },
        { status: 400 },
      );
    }

    // ── Step 1: GPT-4o — análise semântica da transcrição ───────────────
    const userMsg = words && words.length > 0
      ? `Transcrição real (Whisper) do vídeo UGC (${Math.round(videoDuration ?? 60)}s de duração).\n\nTexto completo:\n${text}\n\nTimestamps por palavra (use para calcular durações reais):\n${words.slice(0, 200).map(w => `[${w.start.toFixed(1)}s-${w.end.toFixed(1)}s] ${w.word}`).join(", ")}`
      : `Transcrição do vídeo UGC (${Math.round(videoDuration ?? 60)}s):\n\n${text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "A IA não retornou conteúdo." },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(raw);
    const rawScenes: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scenes)
      ? parsed.scenes
      : (Object.values(parsed).find((v) => Array.isArray(v)) as unknown[] | undefined) ?? [];

    if (!rawScenes.length) {
      return NextResponse.json(
        { error: "A IA não gerou cenas." },
        { status: 500 },
      );
    }

    // ── Step 2: Normalize scenes ────────────────────────────────────────
    const VALID_EMOTIONS = new Set([
      "Revelação","Urgência","Choque","Dor","Esperança",
      "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
    ]);
    const VALID_SFX = new Set(Object.keys(SFX_TO_FREESOUND));

    type RawScene = Record<string, unknown>;
    const scenes: EnrichedScene[] = (rawScenes as RawScene[]).map((sc, i) => {
      const snippet = String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? "").trim();
      const wc = snippet.split(/\s+/).filter(Boolean).length;
      const rawEmotion = String(sc.emotion ?? "Gancho");
      const rawSfx     = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawQ       = Array.isArray(sc.searchQueries) ? sc.searchQueries
                       : Array.isArray(sc.searchKeywords) ? sc.searchKeywords : [];
      return {
        id:           String(sc.id ?? `drs-${i}`),
        textSnippet:  snippet,
        duration:     typeof sc.duration === "number"
          ? Math.max(3.5, Math.min(8.0, sc.duration))
          : Math.max(3.5, Math.min(8.0, Math.round((wc / 2.2) * 10) / 10)),
        emotion:      VALID_EMOTIONS.has(rawEmotion) ? rawEmotion : "Gancho",
        searchQueries:(rawQ as unknown[]).slice(0, 3).map(String),
        suggestedSfx: rawSfx !== null && VALID_SFX.has(String(rawSfx)) ? String(rawSfx) : null,
      };
    });

    // ── Step 3: Pexels + Freesound — em paralelo para cada cena ────────
    const PEXELS_KEY    = process.env.PEXELS_API_KEY ?? "";
    const FREESOUND_KEY = process.env.FREESOUND_KEY  ?? "";

    await Promise.all(scenes.map(async (scene) => {
      await Promise.all([

        // ── Pexels HD video ──────────────────────────────────────────────
        (async () => {
          if (!PEXELS_KEY) return;
          try {
            const q = encodeURIComponent(scene.searchQueries[0] ?? "cinematic broll");
            const res = await fetch(
              `https://api.pexels.com/videos/search?query=${q}&per_page=3&orientation=landscape`,
              { headers: { Authorization: PEXELS_KEY } },
            );
            if (!res.ok) return;
            const data = await res.json();
            const videos: PexelsVideo[] = data?.videos ?? [];
            if (!videos.length) return;

            const opts: Array<{ url: string; thumb: string; query: string }> = [];
            videos.forEach((video, vi) => {
              const files = video.video_files ?? [];
              const hd = files.find(f => f.quality === "hd" && f.width >= 1280)
                      ?? files.slice().sort((a, b) => b.width - a.width)[0];
              if (hd?.link) opts.push({
                url:   hd.link,
                thumb: video.image ?? "",
                query: scene.searchQueries[vi] ?? scene.searchQueries[0],
              });
            });

            if (opts.length) {
              scene.videoUrl     = opts[0].url;
              scene.thumbUrl     = opts[0].thumb;
              scene.videoOptions = opts;
            }
          } catch { /* silent */ }
        })(),

        // ── Freesound SFX ────────────────────────────────────────────────
        (async () => {
          if (!FREESOUND_KEY || !scene.suggestedSfx) return;
          try {
            const sfxQ = SFX_TO_FREESOUND[scene.suggestedSfx] ?? scene.suggestedSfx;
            const res = await fetch(
              `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(sfxQ)}&token=${FREESOUND_KEY}&fields=id,name,previews&page_size=3&filter=duration:[0+TO+8]`,
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

    // ── Step 4: Return ──────────────────────────────────────────────────
    return NextResponse.json({
      scenes,
      backgroundMusicUrl: R2_MUSIC,
    });

  } catch (err: unknown) {
    console.error("[enrich-scenes]", err);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON inválido da IA. Tente novamente." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 },
    );
  }
}
