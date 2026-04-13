// ─────────────────────────────────────────────────────────────────────────────
// 🎵 MUSIC SEARCH — Jamendo + Freesound em paralelo, mapeamento de estilos e cache
//
// Sources:
//   • Jamendo  — música CC, qualidade alta, download MP3 direto
//   • Freesound — biblioteca enorme, preview HQ públicos, CC licensed
//
// Fluxo:
//   1. Traduz music_style da IA → tags Jamendo + query Freesound (STYLE_MAP)
//   2. Dispara Jamendo (multi-query) + Freesound em paralelo
//   3. Merge: Jamendo primeiro (download integral), Freesound como complemento
//   4. Deduplica e retorna até `limit` tracks
//   5. Cache em memória 30 min por estilo
// ─────────────────────────────────────────────────────────────────────────────

export type MusicTrack = {
  url:              string;
  title:            string;
  artist:           string;
  source:           "jamendo" | "freesound" | "vault";
  is_premium_vault: boolean;
};

// ─── Mapeamento estilo → tags ────────────────────────────────────────────────
// Cada entrada tem:
//   jamendo: string de tags separadas por espaço (fuzzytags)
//   freesound: query de texto para busca
const STYLE_MAP: Record<string, { jamendo: string; freesound: string }> = {

  // ── VSL / Direct Response ──────────────────────────────────────────────────
  vsl_tension:              { jamendo: "dramatic suspense dark thriller tension",          freesound: "cinematic suspense background music" },
  vsl:                      { jamendo: "dramatic suspense orchestral cinematic",           freesound: "dramatic background music cinematic" },
  tensao:                   { jamendo: "suspense tension dark dramatic",                   freesound: "tension suspense background" },
  tenso:                    { jamendo: "suspense tension dark dramatic",                   freesound: "tension suspense dark music" },
  tension:                  { jamendo: "suspense tension dark dramatic",                   freesound: "tension dark background music" },
  dramatico:                { jamendo: "dramatic orchestral cinematic",                    freesound: "dramatic orchestral background" },
  dramatic:                 { jamendo: "dramatic orchestral cinematic",                    freesound: "dramatic orchestral music background" },
  suspense:                 { jamendo: "suspense thriller dark cinematic",                 freesound: "suspense thriller background music" },
  thriller:                 { jamendo: "thriller suspense dark dramatic",                  freesound: "thriller suspense music" },
  dark:                     { jamendo: "dark ambient thriller suspense",                   freesound: "dark ambient background music" },

  // ── Épico / Cinematográfico ────────────────────────────────────────────────
  cinematico:               { jamendo: "cinematic orchestral epic soundtrack",             freesound: "cinematic orchestral background music" },
  cinematic:                { jamendo: "cinematic orchestral epic soundtrack",             freesound: "cinematic background music instrumental" },
  epico:                    { jamendo: "epic orchestral dramatic cinematic",               freesound: "epic orchestral music" },
  epic:                     { jamendo: "epic orchestral dramatic cinematic",               freesound: "epic orchestral cinematic music" },
  orquestral:               { jamendo: "orchestral cinematic dramatic epic",               freesound: "orchestral music background" },
  orchestral:               { jamendo: "orchestral cinematic dramatic epic",               freesound: "orchestral background music" },
  soundtrack:               { jamendo: "soundtrack cinematic orchestral",                  freesound: "soundtrack background instrumental" },
  "epic cinematic":         { jamendo: "epic cinematic orchestral dramatic",               freesound: "epic cinematic music background" },
  "dramatic cinematic":     { jamendo: "dramatic cinematic orchestral",                    freesound: "dramatic cinematic background" },

  // ── Energético / Hype ─────────────────────────────────────────────────────
  energetico:               { jamendo: "energetic upbeat electronic pop",                  freesound: "energetic upbeat background music" },
  energetic:                { jamendo: "energetic upbeat electronic",                      freesound: "energetic upbeat music" },
  hype:                     { jamendo: "energetic upbeat motivational electronic",         freesound: "hype energetic music" },
  trap:                     { jamendo: "hiphop trap electronic beats",                     freesound: "trap beat background music" },
  "motivational trap":      { jamendo: "motivational energetic hiphop electronic",         freesound: "motivational trap music" },

  // ── Motivacional / Inspiracional ──────────────────────────────────────────
  motivacional:             { jamendo: "motivational upbeat inspiring positive",           freesound: "motivational inspiring background music" },
  motivational:             { jamendo: "motivational upbeat inspiring",                    freesound: "motivational background music" },
  inspiracional:            { jamendo: "inspiring uplifting motivational positive",        freesound: "inspiring uplifting music" },
  inspirational:            { jamendo: "inspiring uplifting motivational",                 freesound: "inspirational background music" },
  uplifting:                { jamendo: "uplifting inspiring motivational",                 freesound: "uplifting positive music" },
  "corporate motivational": { jamendo: "corporate motivational upbeat inspiring",          freesound: "corporate motivational background" },

  // ── Corporativo / Profissional ────────────────────────────────────────────
  corporativo:              { jamendo: "corporate background professional clean",          freesound: "corporate background music" },
  corporate:                { jamendo: "corporate background professional clean",          freesound: "corporate professional background music" },
  profissional:             { jamendo: "corporate background professional",                freesound: "professional background music" },
  corporate_brand:          { jamendo: "corporate background professional clean",          freesound: "corporate background clean music" },
  institucional:            { jamendo: "corporate background professional ambient",        freesound: "institutional background music" },

  // ── Alegre / Positivo ─────────────────────────────────────────────────────
  alegre:                   { jamendo: "happy upbeat positive cheerful acoustic",          freesound: "happy upbeat cheerful music" },
  happy:                    { jamendo: "happy upbeat positive cheerful",                   freesound: "happy background music" },
  positivo:                 { jamendo: "upbeat positive inspiring happy",                  freesound: "positive upbeat background" },
  cheerful:                 { jamendo: "cheerful happy upbeat positive",                   freesound: "cheerful background music" },

  // ── Calmo / Ambiente ──────────────────────────────────────────────────────
  calmo:                    { jamendo: "ambient chill peaceful relaxing",                  freesound: "calm ambient background music" },
  calm:                     { jamendo: "ambient chill peaceful",                           freesound: "calm peaceful background" },
  ambiente:                 { jamendo: "ambient background peaceful",                      freesound: "ambient background music" },
  ambient:                  { jamendo: "ambient background chill",                         freesound: "ambient background music" },
  lofi:                     { jamendo: "lofi chill background ambient",                    freesound: "lofi background music" },
  "lo-fi":                  { jamendo: "lofi chill background ambient",                    freesound: "lo-fi background music" },
  relaxing:                 { jamendo: "relaxing ambient peaceful piano",                  freesound: "relaxing calm background music" },
  piano:                    { jamendo: "piano ambient emotional instrumental",             freesound: "piano background music instrumental" },

  // ── Emocional / Triste ────────────────────────────────────────────────────
  emocional:                { jamendo: "emotional piano sad melancholic",                  freesound: "emotional background music piano" },
  emotional:                { jamendo: "emotional piano melancholic",                      freesound: "emotional background music" },
  melancolico:              { jamendo: "melancholic sad emotional piano",                  freesound: "melancholic sad background music" },
  melancholic:              { jamendo: "melancholic sad emotional piano",                  freesound: "melancholic background music" },
  sad:                      { jamendo: "sad melancholic emotional piano",                  freesound: "sad background music" },
  triste:                   { jamendo: "sad melancholic emotional",                        freesound: "sad emotional music" },

  // ── Imobiliário / Luxo ────────────────────────────────────────────────────
  imobiliario:              { jamendo: "cinematic ambient luxury background",              freesound: "luxury real estate background music" },
  "real estate":            { jamendo: "cinematic ambient luxury background",              freesound: "real estate background music cinematic" },
  real_estate_cinematic:    { jamendo: "cinematic orchestral ambient luxury",              freesound: "cinematic luxury background music" },
  luxo:                     { jamendo: "ambient cinematic luxury background",              freesound: "luxury background music ambient" },
  luxury:                   { jamendo: "ambient cinematic luxury",                         freesound: "luxury background music" },

  // ── Renda Extra / Finanças ────────────────────────────────────────────────
  "renda extra":            { jamendo: "motivational upbeat energetic positive",           freesound: "motivational background music success" },
  extra_income_hype:        { jamendo: "motivational upbeat energetic electronic",         freesound: "motivational energetic background" },
  financas:                 { jamendo: "corporate motivational professional",              freesound: "corporate finance background music" },
  financeiro:               { jamendo: "corporate motivational professional",              freesound: "corporate professional music" },

  // ── Food / Lifestyle ──────────────────────────────────────────────────────
  food:                     { jamendo: "upbeat happy acoustic cheerful",                   freesound: "upbeat happy acoustic background music" },
  "food porn":              { jamendo: "upbeat happy acoustic cheerful pop",               freesound: "upbeat acoustic happy music" },
  lifestyle:                { jamendo: "upbeat positive acoustic pop",                     freesound: "lifestyle background music upbeat" },
  vlog:                     { jamendo: "upbeat positive acoustic indie",                   freesound: "vlog background music upbeat" },
  podcast:                  { jamendo: "ambient background chill lofi",                    freesound: "podcast background music chill" },

  // ── Casamento / Eventos ───────────────────────────────────────────────────
  casamento:                { jamendo: "romantic emotional piano orchestral",              freesound: "wedding romantic background music" },
  wedding:                  { jamendo: "romantic emotional piano orchestral",              freesound: "wedding background music romantic" },
  romantico:                { jamendo: "romantic emotional piano",                         freesound: "romantic background music piano" },
  romantic:                 { jamendo: "romantic emotional piano",                         freesound: "romantic background music" },

  // ── Mood keys (enrich-scenes) ─────────────────────────────────────────────
  dark_tension:       { jamendo: "dark ambient tension suspense thriller",      freesound: "dark tension suspense background music" },
  emotional_hope:     { jamendo: "emotional inspirational piano hope uplifting", freesound: "emotional hope piano background music" },
  epic_cinematic:     { jamendo: "epic cinematic orchestral dramatic",           freesound: "epic cinematic background music" },
  urgent_pulse:       { jamendo: "electronic dark urgent pulse tension",         freesound: "urgent pulse dark electronic music" },
  mysterious_ambient: { jamendo: "ambient mysterious dark atmospheric",          freesound: "mysterious ambient dark background" },
  triumphant:         { jamendo: "uplifting motivational triumph success",       freesound: "triumphant success uplifting background" },
};

// ─── Normalize ────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim();
}

function resolveStyle(style: string): { jamendo: string; freesound: string } | null {
  const norm = normalize(style);
  if (STYLE_MAP[norm]) return STYLE_MAP[norm];
  for (const [key, tags] of Object.entries(STYLE_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return tags;
  }
  return null;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
type CacheEntry = { tracks: MusicTrack[]; at: number };
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60_000;

// ─── Jamendo ─────────────────────────────────────────────────────────────────
type JamendoTrack = {
  id: string; name: string; artist_name: string;
  audio: string; audiodownload: string;
};

async function queryJamendo(tags: string, limit: number): Promise<MusicTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/` +
      `?client_id=${clientId}&format=json&limit=${limit}` +
      `&fuzzytags=${encodeURIComponent(tags)}&audioformat=mp32&order=popularity_total`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.results ?? []) as JamendoTrack[])
      .filter(t => t.audio || t.audiodownload)
      .map(t => ({
        url:              t.audio || t.audiodownload,
        title:            t.name,
        artist:           t.artist_name,
        source:           "jamendo" as const,
        is_premium_vault: false,
      }));
  } catch { return []; }
}

// ─── Freesound ────────────────────────────────────────────────────────────────
type FreesoundTrack = {
  id: number; name: string;
  previews: { "preview-hq-mp3": string };
  duration: number;
};

async function queryFreesound(query: string, limit: number): Promise<MusicTrack[]> {
  const token = process.env.FREESOUND_KEY;
  if (!token) return [];
  try {
    const res = await fetch(
      `https://freesound.org/apiv2/search/text/` +
      `?query=${encodeURIComponent(query + " background music")}` +
      `&fields=id,name,previews,duration&filter=duration:[30+TO+300]` +
      `&page_size=${limit}&sort=rating_desc`,
      {
        headers:  { Authorization: `Token ${token}` },
        signal:   AbortSignal.timeout(7000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.results ?? []) as FreesoundTrack[])
      .filter(t => t.previews?.["preview-hq-mp3"] && t.duration >= 30)
      .map(t => ({
        url:              t.previews["preview-hq-mp3"],
        title:            t.name.replace(/\.(mp3|wav|ogg|flac)$/i, "").trim(),
        artist:           "Freesound",
        source:           "freesound" as const,
        is_premium_vault: false,
      }));
  } catch { return []; }
}

// ─── API pública ──────────────────────────────────────────────────────────────
/**
 * Busca trilhas para um estilo.
 * Jamendo + Freesound em paralelo. Cache 30 min.
 */
export async function findMusicTracks(
  style: string,
  limit = 5,
): Promise<MusicTrack[]> {
  const cacheKey = `${normalize(style)}:${limit}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.tracks;

  const resolved  = resolveStyle(style);
  const normStyle = normalize(style);

  // Queries Jamendo: mapped tags + estilo original + fallback cinematic
  const jamendoQueries: string[] = [];
  if (resolved?.jamendo) jamendoQueries.push(resolved.jamendo);
  if (normStyle && normStyle !== resolved?.jamendo) jamendoQueries.push(normStyle);
  jamendoQueries.push("cinematic");

  // Query Freesound: mapped query ou estilo original
  const freesoundQuery = resolved?.freesound ?? (normStyle || "cinematic background music");

  // Tudo em paralelo
  const [jamendoResults, freesoundResults] = await Promise.all([
    Promise.all(jamendoQueries.map(q => queryJamendo(q, limit))),
    queryFreesound(freesoundQuery, Math.ceil(limit / 2)),
  ]);

  // Merge: Jamendo primeiro (download integral), Freesound como complemento
  const seen   = new Set<string>();
  const tracks: MusicTrack[] = [];

  const addTrack = (t: MusicTrack) => {
    const key = t.url;
    if (!seen.has(key) && tracks.length < limit) {
      seen.add(key);
      tracks.push(t);
    }
  };

  // Jamendo (ordered: mapped → original → cinematic)
  for (const batch of jamendoResults) {
    for (const t of batch) addTrack(t);
    if (tracks.length >= limit) break;
  }

  // Completar com Freesound se Jamendo não encheu
  for (const t of freesoundResults) addTrack(t);

  _cache.set(cacheKey, { tracks, at: Date.now() });
  return tracks;
}

export function bustMusicCache() { _cache.clear(); }

// Auto-bust on module load so stale audiodownload URLs don't persist
_cache.clear();
