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

// ─── System prompt (VSL Reader & Cutter) ─────────────────────────────────────
// Ported from scripts/vsl_cutter.py — identical logic, runs server-side.

const SYSTEM_PROMPT = `You are a Master Editor of Direct Response videos with 500+ VSLs edited. You think visually with the precision of a Netflix DOP.
Your task: take a sales script and slice it into a sequence of dynamic scenes for a video timeline.

RULES (non-negotiable):
1. Cover 100% of the narration — every word must appear in some textSnippet, in original order, unaltered.
2. Each scene: 1–3 sentences. Focus on retention rhythm and emotional pacing.
3. duration = (word_count / 2.2) + pause
   - pause = 0.6s if ends with . ! ?
   - pause = 0.3s if ends with ... or dramatic comma
   - Min 3.5s · Max 9.0s · Round to 1 decimal.
4. emotion: EXACTLY one of:
   Revelação · Urgência · Choque · Dor · Esperança · Oportunidade · Mistério · Gancho · CTA · Vantagem · Prova Social
5. searchQueries: 4 DIFFERENT English queries for Pexels/Pixabay stock footage. Each must be a unique visual angle.
   USE THE NICHE to choose ULTRA-SPECIFIC queries — generic queries waste the cut.

   QUERY STRUCTURE (follow exactly):
   - Q1: PERSON + action + emotion  (concrete subject + verb + facial/body expression)
     FINANÇAS:     "frustrated man counting empty wallet kitchen night"
     SAÚDE:        "woman grimacing knee pain holding leg sofa"
     EMAGRECIMENTO:"woman measuring waist frustrated bathroom mirror"
     IMOBILIÁRIO:  "couple signing house keys smiling agent office"
     RELACIONAMENTO:"couple arguing kitchen frustrated night"
     DIGITAL/RENDA:"young man laptop multiple income screens excited"
     JURÍDICO:     "stressed man reading legal documents desk night"

   - Q2: ENVIRONMENT + light/atmosphere (no person, or blurred far background)
     FINANÇAS:     "dark moody office desk scattered bills overdue closeup"
     SAÚDE:        "hospital corridor white light blur dramatic"
     EMAGRECIMENTO:"empty plate fork salad light diet table"
     IMOBILIÁRIO:  "aerial drone luxury neighborhood sunrise suburb"
     RELACIONAMENTO:"empty bedroom window rain melancholic"
     DIGITAL/RENDA:"home office setup multiple monitors night glow"
     JURÍDICO:     "courtroom wood gavel desk dramatic light"

   - Q3: OBJECT macro / extreme close-up
     FINANÇAS:     "stack hundred dollar bills rotating macro slow motion"
     SAÚDE:        "pill bottle prescription label closeup macro"
     EMAGRECIMENTO:"weighing scale number closeup macro"
     IMOBILIÁRIO:  "house keys hand bokeh sunlight macro"
     RELACIONAMENTO:"wedding ring box open closeup macro bokeh"
     DIGITAL/RENDA:"smartphone notification earnings app closeup macro"
     JURÍDICO:     "contract pen signing closeup macro"

   - Q4: Cinematic VISUAL METAPHOR (abstract/symbolic)
     FINANÇAS:     "time lapse stock market graph rising falling abstract"
     SAÚDE:        "healthy cells microscope abstract colorful"
     EMAGRECIMENTO:"butterfly metamorphosis timelapse transformation abstract"
     IMOBILIÁRIO:  "sunrise city skyline golden hour timelapse"
     RELACIONAMENTO:"bridge over calm water sunrise hope abstract"
     DIGITAL/RENDA:"data streams digital code rain abstract blue"
     JURÍDICO:     "scales justice balance abstract close up"

6. suggestedSfx: EXACTLY one of or null:
   "riser" · "impact" · "glitch" · "cash_register" · "heartbeat" · "bell" · "whoosh" · "tension_sting" · null
7. musicMood: EXACTLY one of:
   "dark_tension" · "emotional_hope" · "epic_cinematic" · "urgent_pulse" · "mysterious_ambient" · "triumphant" · "melancholic"

Return ONLY valid JSON — no markdown, no commentary:
{
  "scenes": [
    {
      "id": "drs-0",
      "textSnippet": "exact excerpt from script",
      "duration": 4.2,
      "emotion": "Dor",
      "searchQueries": [
        "frustrated man counting empty wallet kitchen night",
        "dark moody office desk scattered bills overdue closeup",
        "stack hundred dollar bills rotating macro slow motion",
        "time lapse stock market graph rising falling abstract"
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

// ─── Valid value sets ─────────────────────────────────────────────────────────
const VALID_EMOTIONS = new Set([
  "Revelação","Urgência","Choque","Dor","Esperança",
  "Oportunidade","Mistério","Gancho","CTA","Vantagem","Prova Social",
]);
const VALID_SFX = new Set([
  "riser","impact","glitch","cash_register","heartbeat","bell","whoosh","tension_sting",
]);
const VALID_MOODS = new Set([
  "dark_tension","emotional_hope","epic_cinematic","urgent_pulse",
  "mysterious_ambient","triumphant","melancholic",
]);
const EMOTION_TO_MOOD: Record<string, string> = {
  Dor:           "dark_tension",
  Choque:        "dark_tension",
  Urgência:      "urgent_pulse",
  Mistério:      "mysterious_ambient",
  Gancho:        "dark_tension",
  Revelação:     "epic_cinematic",
  Esperança:     "emotional_hope",
  Oportunidade:  "triumphant",
  Vantagem:      "triumphant",
  CTA:           "urgent_pulse",
  "Prova Social":"emotional_hope",
};
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
const MUSIC_EMOTION_MAP: Record<string, { pixabayQueries: string[]; jamendoTags: string; jamendoSpeed: string; fallbackUrl: string; title: string }> = {
  dark_tension:       { pixabayQueries:["dark tension suspense","horror ambient drone"], jamendoTags:"dark+ambient+tension",     jamendoSpeed:"low",     fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Dark Tension" },
  emotional_hope:     { pixabayQueries:["emotional piano hope uplifting","heartfelt strings"], jamendoTags:"emotional+inspirational+piano", jamendoSpeed:"medium", fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Emotional Hope" },
  epic_cinematic:     { pixabayQueries:["epic orchestral cinematic","powerful dramatic score"],  jamendoTags:"epic+cinematic+orchestral",    jamendoSpeed:"high",   fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Epic Cinematic" },
  urgent_pulse:       { pixabayQueries:["urgent electronic pulse","ticking tension"],            jamendoTags:"electronic+dark+urgent",       jamendoSpeed:"high",   fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Urgent Pulse" },
  mysterious_ambient: { pixabayQueries:["mysterious ambient dark","eerie atmospheric"],          jamendoTags:"ambient+mysterious+dark",       jamendoSpeed:"verylow",fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Mysterious Ambient" },
  triumphant:         { pixabayQueries:["triumphant success victory","uplifting motivational"],  jamendoTags:"uplifting+motivational+triumph",jamendoSpeed:"high",   fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Triumphant" },
  melancholic:        { pixabayQueries:["melancholic sad piano","emotional sad background"],     jamendoTags:"melancholic+sad+piano",         jamendoSpeed:"low",    fallbackUrl:"https://pub-9937ef38e0a744128bd67f59e5476f23.r2.dev/Epic%20Orchestral%20Cinematic%20Documentary%201.mp3", title:"Melancholic" },
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
    return ((data?.videos ?? []) as PexelsVideo[]).flatMap(v => {
      const files = v.video_files ?? [];
      const hd = files.find(f => f.quality === "hd" && f.width >= 1920)
              ?? files.find(f => f.quality === "hd" && f.width >= 1280)
              ?? files.find(f => f.quality === "hd")
              ?? files.slice().sort((a, b) => b.width - a.width)[0];
      if (!hd?.link) return [];
      return [{ url: hd.link, thumb: v.image ?? "", query, source: "pexels" as const }];
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
    return ((data?.hits ?? []) as PixabayHit[]).flatMap(h => {
      const v = h.videos?.large ?? h.videos?.medium;
      if (!v?.url) return [];
      return [{ url: v.url, thumb: h.userImageURL ?? "", query, source: "pixabay" as const }];
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
    const track = ((data?.results ?? []) as Array<{ audio: string; name: string; artist_name: string }>).find(t => t.audio);
    return track ? { url: track.audio, title: `${track.name} — ${track.artist_name}` } : null;
  } catch { return null; }
}

// ─── POST /api/generate-timeline ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Credit check & deduction (server-side, admin client) ─────────────────
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
  await supabaseAdmin.from("profiles")
    .update({ credits: currentCredits - cost }).eq("id", user.id);

  try {
    const body = await req.json();
    const copy = typeof body?.copy === "string" ? body.copy.trim() : "";
    if (!copy)
      return NextResponse.json({ error: "O campo 'copy' é obrigatório." }, { status: 400 });

    // ── Stage 1: VSL scene-cutter (gpt-4o — best niche detection & query quality) ──
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `Break this VSL copy into timeline scenes:\n\n${copy}` },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      // Refund on AI failure
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

    // ── Normalize + validate scenes ───────────────────────────────────────────
    type RawScene = Record<string, unknown>;
    const scenes: DRScene[] = (rawScenes as RawScene[]).map((sc, i) => {
      const text     = String(sc.textSnippet ?? sc.narration_text ?? sc.text_chunk ?? sc.text ?? "").trim();
      const wc       = text.split(/\s+/).filter(Boolean).length;
      const rawEmo   = String(sc.emotion ?? "Gancho");
      const rawSfx   = sc.suggestedSfx ?? sc.sfx ?? null;
      const rawMood  = String(sc.musicMood ?? "");
      const rawQ     = Array.isArray(sc.searchQueries) ? sc.searchQueries
                     : Array.isArray(sc.keywords_broll) ? sc.keywords_broll
                     : Array.isArray(sc.searchKeywords) ? sc.searchKeywords : [];
      const emotion  = VALID_EMOTIONS.has(rawEmo) ? rawEmo : "Gancho";
      const musicMood = VALID_MOODS.has(rawMood) ? rawMood : (EMOTION_TO_MOOD[emotion] ?? "dark_tension");
      return {
        id:           String(sc.id ?? `drs-${i}`),
        textSnippet:  text,
        duration:     typeof sc.duration === "number"
          ? Math.max(3.5, Math.min(9.0, sc.duration))
          : Math.max(3.5, Math.min(9.0, Math.round((wc / 2.2 + 0.6) * 10) / 10)),
        emotion,
        musicMood,
        searchQueries: (rawQ as unknown[]).slice(0, 4).map(String),
        suggestedSfx:  rawSfx !== null && VALID_SFX.has(String(rawSfx)) ? String(rawSfx) : null,
      };
    });

    // ── Stage 2: Deduplicated B-roll fetch ───────────────────────────────────
    // Old: O(scenes × 4 × 2) = 80 calls for 10 scenes
    // New: O(unique queries × 2) ≈ 15 calls for 10 scenes (75% fewer)
    const PEXELS_KEY    = process.env.PEXELS_API_KEY   ?? "";
    const PIXABAY_KEY   = process.env.PIXABAY_API_KEY  ?? "";
    const FREESOUND_KEY = process.env.FREESOUND_KEY    ?? "";
    const JAMENDO_ID    = process.env.JAMENDO_CLIENT_ID ?? "";

    const uniqueQueries = [...new Set(scenes.flatMap(s => s.searchQueries))];
    const queryResultMap = new Map<string, { pexels: VideoOpt[]; pixabay: VideoOpt[] }>();
    await Promise.all(uniqueQueries.map(async q => {
      const [pexels, pixabay] = await Promise.all([
        PEXELS_KEY  ? fetchPexels(q, PEXELS_KEY, 5) : Promise.resolve([] as VideoOpt[]),
        PIXABAY_KEY ? fetchPixabay(q, PIXABAY_KEY, 5) : Promise.resolve([] as VideoOpt[]),
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

    // Freesound SFX (per-scene, small, no dedup needed)
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

    // ── Stage 3: Background music — top 3 moods ───────────────────────────────
    const moodCount: Record<string, number> = {};
    for (const s of scenes) {
      const m = s.musicMood ?? "dark_tension";
      moodCount[m] = (moodCount[m] ?? 0) + 1;
    }
    const topMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);

    interface MusicTrack { url: string; title: string; is_premium_vault: boolean; }
    const backgroundTracks: MusicTrack[] = [];

    await Promise.all(topMoods.map(async (mood, idx) => {
      const cfg = MUSIC_EMOTION_MAP[mood] ?? MUSIC_EMOTION_MAP["dark_tension"];
      let track: { url: string; title: string } | null = null;
      if (JAMENDO_ID)  track = await fetchJamendoMusic(cfg.jamendoTags, cfg.jamendoSpeed, JAMENDO_ID);
      if (!track && PIXABAY_KEY) {
        const hits = await Promise.all(cfg.pixabayQueries.map(q => fetchPixabayMusic(q, PIXABAY_KEY)));
        track = hits.find(Boolean) ?? null;
      }
      backgroundTracks[idx] = { url: track?.url ?? cfg.fallbackUrl, title: track?.title ?? cfg.title, is_premium_vault: !track };
    }));

    const primaryMood    = topMoods[0] ?? "dark_tension";
    const backgroundMusicUrl = backgroundTracks[0]?.url ?? MUSIC_EMOTION_MAP[primaryMood]?.fallbackUrl;

    return NextResponse.json({
      scenes,
      backgroundMusicUrl,
      backgroundTracks: backgroundTracks.filter(t => t?.url),
    });

  } catch (err: unknown) {
    // Refund on unexpected error
    await supabaseAdmin.from("profiles").update({ credits: currentCredits }).eq("id", user.id);
    console.error("[generate-timeline]", err);
    if (err instanceof SyntaxError)
      return NextResponse.json({ error: "JSON inválido da IA. Tente novamente." }, { status: 500 });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}
