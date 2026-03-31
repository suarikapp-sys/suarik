import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um editor sênior de VSLs e Diretor de Arte especializado em Direct Response.

Sua tarefa: quebrar o texto recebido em cenas de 3 a 5 segundos, identificar o gatilho emocional de cada trecho e gerar metadados visuais e sonoros precisos para o editor montar a timeline.

═══════════════════════════════════════════════
REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. PROCESSE 100% DO TEXTO. Não pule nenhuma frase. Cada palavra deve aparecer em algum textSnippet.
2. textSnippet: trecho EXATO da copy, na ordem original, sem alterações.
3. duration: calcule baseado no tempo real de leitura em voz alta de um locutor de VSL.
   Fórmula: (palavras ÷ 2.2) + pausa_dramática
   - pausa_dramática = 0.6s se o trecho termina com ponto final, exclamação ou interrogação
   - pausa_dramática = 0.3s se o trecho termina com reticências ou vírgula marcante
   - pausa_dramática = 0s nos demais casos
   - Mínimo: 3.5s · Máximo: 9.0s · Arredonde para 1 casa decimal.
4. emotion: classifique o gatilho emocional dominante do trecho. Use EXATAMENTE um destes valores:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
5. searchQueries: TRÊS termos em inglês para busca no Pexels/Unsplash. REGRA CRÍTICA:
   - Analise o CONCEITO VISUAL, não traduza literalmente o português.
   - "bug no sistema financeiro" → ["financial system glitch hack", "money fraud digital network", "banking vulnerability exposed"] ← CORRETO
   - Termos devem ser concretos, literais e buscáveis (evite: "success", "concept", "abstract").
6. suggestedSfx: tipo de SFX ideal para o início deste corte. Use EXATAMENTE um destes valores ou null:
   "riser" · "impact" · "glitch" · "cash_register" · "heartbeat" · "bell" · "whoosh" · "tension_sting" · null

Retorne APENAS este JSON (sem texto fora dele):
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "trecho exato da copy aqui",
      "duration": 3.6,
      "emotion": "Revelação",
      "searchQueries": ["financial system glitch", "banking fraud exposed", "money digital corruption"],
      "suggestedSfx": "glitch"
    }
  ]
}`;

// ─── Pexels types ─────────────────────────────────────────────────────────────
interface PexelsFile  { quality: string; width: number; link: string; }
interface PexelsVideo { image: string; video_files: PexelsFile[]; }

// ─── SFX → Freesound search query mapping ────────────────────────────────────
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

// ─── Emotion → background music URL ──────────────────────────────────────────
const R2 = "https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3";
const EMOTION_MUSIC: Record<string, string> = {
  Revelação:     R2,
  Urgência:      R2,
  Choque:        R2,
  Mistério:      R2,
  Gancho:        R2,
  CTA:           R2,
  Dor:           "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  Esperança:     "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  Oportunidade:  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  Vantagem:      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "Prova Social":"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
};

// ─── Normalised scene shape (before media enrichment) ────────────────────────
interface DRScene {
  id:             string;
  textSnippet:    string;
  duration:       number;
  emotion:        string;
  searchQueries:  string[];
  suggestedSfx:   string | null;
  // populated during media enrichment:
  videoUrl?:      string | null;
  thumbUrl?:      string | null;
  sfxPreviewUrl?: string | null;
  videoOptions?:  Array<{ url: string; thumb: string; query: string }>;
}

// ─── POST /api/generate-timeline ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const copy = typeof body?.copy === "string" ? body.copy.trim() : "";
    if (!copy)
      return NextResponse.json({ error: "O campo 'copy' é obrigatório." }, { status: 400 });

    // ── Step 1: OpenAI — semantic scene analysis ──────────────────────────
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `Quebre esta copy em cenas para a timeline de VSL:\n\n${copy}` },
      ],
      temperature: 0.35,
      max_tokens:  4096,
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

    // ── Step 2: Normalize scenes ──────────────────────────────────────────
    const VALID_EMOTIONS = new Set([
      "Revelação","Urgência","Choque","Dor","Esperança",
      "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
    ]);
    const VALID_SFX = new Set([
      "riser","impact","glitch","cash_register","heartbeat",
      "bell","whoosh","tension_sting",
    ]);

    type RawScene = Record<string, unknown>;
    const scenes: DRScene[] = (rawScenes as RawScene[]).map((sc, i) => {
      const wc = String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? "")
        .trim().split(/\s+/).filter(Boolean).length;
      const rawEmotion = String(sc.emotion ?? "Gancho");
      const rawSfx     = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawQ       = Array.isArray(sc.searchQueries) ? sc.searchQueries
                       : Array.isArray(sc.searchKeywords) ? sc.searchKeywords : [];
      return {
        id:           String(sc.id ?? `drs-${i}`),
        textSnippet:  String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? ""),
        duration:     typeof sc.duration === "number"
          ? Math.max(3.5, Math.min(9.0, sc.duration))
          : Math.max(3.5, Math.min(9.0, Math.round((wc / 2.2) * 10) / 10)),
        emotion:      VALID_EMOTIONS.has(rawEmotion) ? rawEmotion : "Gancho",
        searchQueries:(rawQ as unknown[]).slice(0, 3).map(String),
        suggestedSfx: rawSfx !== null && VALID_SFX.has(String(rawSfx)) ? String(rawSfx) : null,
      };
    });

    // ── Step 3: Media enrichment — Pexels + Freesound in parallel ────────
    const PEXELS_KEY   = process.env.PEXELS_API_KEY ?? "";
    const FREESOUND_KEY= process.env.FREESOUND_KEY  ?? "";

    await Promise.all(scenes.map(async (scene) => {
      await Promise.all([

        // ── Motor Visual: Pexels HD video ──────────────────────────────────
        (async () => {
          if (!PEXELS_KEY) return;
          try {
            // Use primary searchQuery — returns up to 3 videos for alternatives
            const q = encodeURIComponent(scene.searchQueries[0] ?? "cinematic broll");
            const res = await fetch(
              `https://api.pexels.com/videos/search?query=${q}&per_page=3&orientation=landscape`,
              { headers: { Authorization: PEXELS_KEY } }
            );
            if (!res.ok) return;
            const data = await res.json();
            const videos: PexelsVideo[] = data?.videos ?? [];
            if (!videos.length) return;

            // Build video options (up to 3 alternatives)
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
          } catch { /* silent — player falls back to static thumb */ }
        })(),

        // ── Motor de Efeitos: Freesound SFX preview ─────────────────────────
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

    // ── Step 4: Trilha Sonora — dominant emotion → music URL ─────────────
    const emotionCount: Record<string, number> = {};
    for (const s of scenes) emotionCount[s.emotion] = (emotionCount[s.emotion] ?? 0) + 1;
    const dominantEmotion = Object.entries(emotionCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Gancho";
    const backgroundMusicUrl = EMOTION_MUSIC[dominantEmotion] ?? R2;

    // ── Step 5: Return enriched response ─────────────────────────────────
    return NextResponse.json({ scenes, backgroundMusicUrl });

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
