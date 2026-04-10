// ─── /api/enrich-scenes ──────────────────────────────────────────────────────
// Receives real Whisper transcript → generates enriched DRS scenes:
//   1. gpt-4o-mini — scene splitting + cinematic queries (was gpt-4o, 33× cheaper)
//   2. Pexels + Pixabay — deduplicated B-roll (unique queries fetched once)
//   3. Freesound — SFX previews
//   4. Jamendo → Pixabay Music → vault fallback for background tracks
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost } from "@/app/lib/creditCost";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── System prompt ────────────────────────────────────────────────────────────
// Stage 1 (context extraction) removed — the scene prompt infers niche directly,
// saving one full API round-trip (~200 tokens + latency) per call.

const SCENE_PROMPT = `You are a senior cinematic Art Director specialized in Direct Response UGC videos.
You receive a real Whisper transcript and split it into timeline scenes.

RULES:
1. Cover 100% of the transcript — every word in some textSnippet, original order, unaltered.
2. Each scene: 1–3 sentences, 4–7 seconds. Use Whisper timestamps for real duration when available.
   duration = real end_ts − start_ts. Min 3.5s · Max 8.0s · Round to 1 decimal.
3. emotion: EXACTLY one of:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
4. searchQueries: 4 DIFFERENT English Pexels queries, each a unique visual angle:
   - Q1: PERSON + action + emotion
   - Q2: ENVIRONMENT + light/atmosphere (no person or blurred bg)
   - Q3: OBJECT macro / extreme close-up
   - Q4: Cinematic VISUAL METAPHOR (abstract/symbolic)
5. suggestedSfx: one of or null:
   "riser" · "impact" · "glitch" · "cash_register" · "heartbeat" · "bell" · "whoosh" · "tension_sting" · null
6. musicMood: one of:
   "dark_tension" · "emotional_hope" · "epic_cinematic" · "urgent_pulse" · "mysterious_ambient" · "triumphant" · "melancholic"

Return ONLY valid JSON — no markdown:
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "exact transcript excerpt",
      "duration": 4.5,
      "emotion": "Dor",
      "searchQueries": ["q1","q2","q3","q4"],
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

const MUSIC_MOOD_MAP: Record<string, { pixabayQueries: string[]; jamendoTags: string; jamendoSpeed: string; fallbackUrl: string; title: string }> = {
  dark_tension:       { pixabayQueries:["dark tension suspense","horror ambient drone"],        jamendoTags:"dark+ambient+tension",          jamendoSpeed:"low",     fallbackUrl:R2_MUSIC, title:"Dark Tension" },
  emotional_hope:     { pixabayQueries:["emotional piano hope","heartfelt cinematic strings"],  jamendoTags:"emotional+inspirational+piano", jamendoSpeed:"medium",  fallbackUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", title:"Emotional Hope" },
  epic_cinematic:     { pixabayQueries:["epic orchestral cinematic","powerful dramatic score"], jamendoTags:"epic+cinematic+orchestral",     jamendoSpeed:"high",    fallbackUrl:R2_MUSIC, title:"Epic Cinematic" },
  urgent_pulse:       { pixabayQueries:["urgent electronic pulse","ticking dark tension"],      jamendoTags:"electronic+dark+urgent",        jamendoSpeed:"high",    fallbackUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", title:"Urgent Pulse" },
  mysterious_ambient: { pixabayQueries:["mysterious ambient dark","eerie atmospheric"],         jamendoTags:"ambient+mysterious+dark",       jamendoSpeed:"verylow", fallbackUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", title:"Mysterious Ambient" },
  triumphant:         { pixabayQueries:["triumphant success victory","uplifting motivational"], jamendoTags:"uplifting+motivational+triumph",jamendoSpeed:"high",    fallbackUrl:R2_MUSIC, title:"Triumphant" },
  melancholic:        { pixabayQueries:["melancholic sad piano","emotional sad background"],    jamendoTags:"melancholic+sad+piano",         jamendoSpeed:"low",     fallbackUrl:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", title:"Melancholic" },
};
const EMOTION_TO_MOOD: Record<string, string> = {
  Dor:"dark_tension", Choque:"dark_tension", Urgência:"urgent_pulse", Mistério:"mysterious_ambient",
  Gancho:"dark_tension", Revelação:"epic_cinematic", Esperança:"emotional_hope",
  Oportunidade:"triumphant", Vantagem:"triumphant", CTA:"urgent_pulse", "Prova Social":"emotional_hope",
};

// ─── Media helpers ────────────────────────────────────────────────────────────

async function fetchPexels(query: string, key: string): Promise<VideoOpt[]> {
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&min_width=1280`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.videos ?? []) as PexelsVideo[]).flatMap(v => {
      const files = v.video_files ?? [];
      const hd = files.find(f => f.quality === "hd" && f.width >= 1920)
              ?? files.find(f => f.quality === "hd" && f.width >= 1280)
              ?? files.find(f => f.quality === "hd")
              ?? files.slice().sort((a, b) => b.width - a.width)[0];
      if (!hd?.link) return [];
      return [{ url: hd.link, thumb: v.image ?? "", query }];
    });
  } catch { return []; }
}

async function fetchPixabay(query: string, key: string): Promise<VideoOpt[]> {
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=3&video_type=film&min_width=1280`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.hits ?? []) as PixabayHit[]).flatMap(h => {
      const url = h.videos?.large?.url ?? h.videos?.medium?.url;
      if (!url) return [];
      return [{ url, thumb: h.userImageURL ?? "", query }];
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
      `&tags=${encodeURIComponent(tags)}&speed=${speed}&audioformat=mp3`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const t = ((data?.results ?? []) as Array<{ audio: string; name: string; artist_name: string }>).find(r => r.audio);
    return t ? { url: t.audio, title: `${t.name} — ${t.artist_name}` } : null;
  } catch { return null; }
}

// ─── POST /api/enrich-scenes ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Credit check & deduction (admin client, consistent with other routes) ──
  const cost = computeCost("timeline");
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("credits").eq("id", user.id).single();
  const currentCredits = (profile as { credits: number } | null)?.credits ?? 0;
  if (currentCredits < cost) {
    return NextResponse.json(
      { error: "Créditos insuficientes", code: "INSUFFICIENT_CREDITS", required: cost, credits: currentCredits },
      { status: 402 }
    );
  }
  await supabaseAdmin.from("profiles").update({ credits: currentCredits - cost }).eq("id", user.id);

  try {
    const body = await req.json();
    const { text, words, videoDuration } = body as {
      text?: string;
      words?: Array<{ word: string; start: number; end: number }>;
      videoDuration?: number;
    };

    if (!text?.trim())
      return NextResponse.json({ error: "Campo 'text' (transcrição) é obrigatório." }, { status: 400 });

    // ── Scene analysis: gpt-4o-mini (was gpt-4o — 33× cost reduction) ────────
    const userMsg = words?.length
      ? `Video transcript (${Math.round(videoDuration ?? 60)}s) with Whisper timestamps:\n\n${text}\n\nTimestamps:\n${words.slice(0, 200).map(w => `[${w.start.toFixed(1)}s-${w.end.toFixed(1)}s] ${w.word}`).join(", ")}`
      : `Video transcript (${Math.round(videoDuration ?? 60)}s):\n\n${text}`;

    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SCENE_PROMPT },
        { role: "user",   content: userMsg },
      ],
      temperature: 0.2,
      max_tokens:  4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      await supabaseAdmin.from("profiles").update({ credits: currentCredits }).eq("id", user.id);
      return NextResponse.json({ error: "A IA não retornou conteúdo." }, { status: 500 });
    }

    const parsed = JSON.parse(raw);
    const rawScenes: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scenes)
      ? parsed.scenes
      : (Object.values(parsed).find(v => Array.isArray(v)) as unknown[] | undefined) ?? [];

    if (!rawScenes.length) {
      await supabaseAdmin.from("profiles").update({ credits: currentCredits }).eq("id", user.id);
      return NextResponse.json({ error: "A IA não gerou cenas." }, { status: 500 });
    }

    // ── Normalize scenes ──────────────────────────────────────────────────────
    const VALID_EMOTIONS = new Set([
      "Revelação","Urgência","Choque","Dor","Esperança",
      "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
    ]);
    const VALID_SFX   = new Set(Object.keys(SFX_TO_FREESOUND));
    const VALID_MOODS = new Set(Object.keys(MUSIC_MOOD_MAP));

    type RawScene = Record<string, unknown>;
    const scenes: EnrichedScene[] = (rawScenes as RawScene[]).map((sc, i) => {
      const snippet = String(sc.textSnippet ?? sc.text_chunk ?? sc.text ?? "").trim();
      const wc      = snippet.split(/\s+/).filter(Boolean).length;
      const rawEmo  = String(sc.emotion ?? "Gancho");
      const rawSfx  = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawMood = String(sc.musicMood ?? "");
      const rawQ    = Array.isArray(sc.searchQueries) ? sc.searchQueries
                    : Array.isArray(sc.searchKeywords) ? sc.searchKeywords : [];
      const emotion  = VALID_EMOTIONS.has(rawEmo) ? rawEmo : "Gancho";
      return {
        id:           String(sc.id ?? `drs-${i}`),
        textSnippet:  snippet,
        duration:     typeof sc.duration === "number"
          ? Math.max(3.5, Math.min(8.0, sc.duration))
          : Math.max(3.5, Math.min(8.0, Math.round((wc / 2.2 + 0.6) * 10) / 10)),
        emotion,
        musicMood:    VALID_MOODS.has(rawMood) ? rawMood : (EMOTION_TO_MOOD[emotion] ?? "dark_tension"),
        searchQueries:(rawQ as unknown[]).slice(0, 4).map(String),
        suggestedSfx: rawSfx !== null && VALID_SFX.has(String(rawSfx)) ? String(rawSfx) : null,
      };
    });

    // ── Deduplicated B-roll fetch ─────────────────────────────────────────────
    // Old: O(scenes × 4 queries × 2 sources) = 80 calls for 10 scenes
    // New: O(unique queries × 2 sources) = ~15 calls for 10 scenes (75% fewer)
    const PEXELS_KEY    = process.env.PEXELS_API_KEY    ?? "";
    const PIXABAY_KEY   = process.env.PIXABAY_API_KEY   ?? "";
    const FREESOUND_KEY = process.env.FREESOUND_KEY     ?? "";
    const JAMENDO_ID    = process.env.JAMENDO_CLIENT_ID ?? "";

    const uniqueQueries = [...new Set(scenes.flatMap(s => s.searchQueries))];

    const queryResultMap = new Map<string, { pexels: VideoOpt[]; pixabay: VideoOpt[] }>();
    await Promise.all(uniqueQueries.map(async q => {
      const [pexels, pixabay] = await Promise.all([
        PEXELS_KEY  ? fetchPexels(q, PEXELS_KEY)   : Promise.resolve([] as VideoOpt[]),
        PIXABAY_KEY ? fetchPixabay(q, PIXABAY_KEY) : Promise.resolve([] as VideoOpt[]),
      ]);
      queryResultMap.set(q, { pexels, pixabay });
    }));

    const usedUrls = new Set<string>();
    for (const scene of scenes) {
      const opts: VideoOpt[] = [];
      const seen  = new Set<string>();
      const add   = (item: VideoOpt) => {
        if (!usedUrls.has(item.url) && !seen.has(item.url)) { seen.add(item.url); opts.push(item); }
      };
      for (const q of scene.searchQueries) {
        const r = queryResultMap.get(q);
        if (!r) continue;
        const maxLen = Math.max(r.pexels.length, r.pixabay.length);
        for (let i = 0; i < maxLen; i++) {
          if (r.pexels[i])  add(r.pexels[i]);
          if (r.pixabay[i]) add(r.pixabay[i]);
        }
      }
      if (opts.length) {
        scene.videoUrl     = opts[0].url;
        scene.thumbUrl     = opts[0].thumb;
        scene.videoOptions = opts.slice(0, 12);
        usedUrls.add(opts[0].url);
      }
    }

    // SFX (per-scene, small, no dedup needed)
    await Promise.all(scenes.map(async scene => {
      if (!FREESOUND_KEY || !scene.suggestedSfx) return;
      try {
        const q   = SFX_TO_FREESOUND[scene.suggestedSfx] ?? scene.suggestedSfx;
        const res = await fetch(
          `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&token=${FREESOUND_KEY}&fields=id,name,previews&page_size=3&filter=duration:[0+TO+8]`
        );
        if (!res.ok) return;
        const data = await res.json();
        const preview = (data?.results as Array<{ previews: Record<string, string> }>)
          ?.find(r => r.previews?.["preview-hq-mp3"])?.previews["preview-hq-mp3"];
        if (preview) scene.sfxPreviewUrl = preview;
      } catch { /* silent */ }
    }));

    // ── Background music — top 3 moods ────────────────────────────────────────
    const moodCount: Record<string, number> = {};
    for (const s of scenes) {
      const m = s.musicMood ?? "dark_tension";
      moodCount[m] = (moodCount[m] ?? 0) + 1;
    }
    const topMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);

    interface MusicTrack { url: string; title: string; is_premium_vault: boolean; }
    const backgroundTracks: MusicTrack[] = [];

    await Promise.all(topMoods.map(async (mood, idx) => {
      const cfg = MUSIC_MOOD_MAP[mood] ?? MUSIC_MOOD_MAP["dark_tension"];
      let track: { url: string; title: string } | null = null;
      if (JAMENDO_ID)  track = await fetchJamendoMusic(cfg.jamendoTags, cfg.jamendoSpeed, JAMENDO_ID);
      if (!track && PIXABAY_KEY) {
        const hits = await Promise.all(cfg.pixabayQueries.map(q => fetchPixabayMusic(q, PIXABAY_KEY)));
        track = hits.find(Boolean) ?? null;
      }
      backgroundTracks[idx] = { url: track?.url ?? cfg.fallbackUrl, title: track?.title ?? cfg.title, is_premium_vault: !track };
    }));

    return NextResponse.json({
      scenes,
      backgroundMusicUrl: backgroundTracks[0]?.url ?? R2_MUSIC,
      backgroundTracks:   backgroundTracks.filter(t => t?.url),
    });

  } catch (err: unknown) {
    await supabaseAdmin.from("profiles").update({ credits: currentCredits }).eq("id", user.id);
    console.error("[enrich-scenes]", err);
    if (err instanceof SyntaxError)
      return NextResponse.json({ error: "JSON inválido da IA. Tente novamente." }, { status: 500 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}
