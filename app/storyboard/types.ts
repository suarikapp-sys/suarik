// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoOption {
  url: string;
  source?: string;
  vault_category?: string;
  thumb?: string;
}

export interface BackgroundTrack {
  url: string;
  title: string;
  is_premium_vault: boolean;
}

export interface Scene {
  segment: string;
  text_chunk?: string;
  vault_category?: string;
  sound_effect?: string;
  broll_search_keywords?: string;
  video_url?: string;
  video_options?: VideoOption[];
  sfx_url?: string;
  sfx_options?: string[];
  estimated_duration_seconds?: number;
}

export interface GenerateResponse {
  project_vibe: string;
  music_style: string;
  scenes: Scene[];
  background_tracks: BackgroundTrack[];
}

// Each individual clip block on the V1 track (a scene may split into multiple clips)
export interface TimelineClip {
  id: string;           // unique — used as React key
  sceneIdx: number;
  url: string | null;   // null = gap placeholder (colored, not black)
  thumb?: string;       // static preview image (always visible, no video loading needed)
  triggerWord?: string; // exact keyword that caused this image to be selected
  startSec: number;     // global timeline start
  durSec: number;       // how long this block lasts
  label: string;
  color: string;
}

// ─── SubtitleWord: karaoke timing model ──────────────────────────────────────
export interface SubtitleWord {
  word: string;
  startSec: number;
  endSec: number;
  isKeyword: boolean;   // in BROLL_IMAGES (triggers image swap)
  cleanWord: string;    // normalized for lookup
}

// ─── DirectResponseScene: output of the AI Art Director ──────────────────────
// This is the SOURCE OF TRUTH for the timeline. Every clip, subtitle word,
// and SFX event is derived from this structure — not from raw Scene data.
// Media fields (videoUrl, thumbUrl, sfxPreviewUrl, videoOptions) are populated
// server-side by /api/generate-timeline via Pexels + Freesound fetches.
export interface DirectResponseScene {
  id:              string;
  textSnippet:     string;        // exact phrase being spoken in this segment
  duration:        number;        // seconds, calculated from reading time (words/2.8)
  emotion:         string;        // e.g. "Revelação", "Urgência", "Choque"
  searchQueries:   string[];      // 3 English Pexels-optimized visual concepts
  suggestedSfx:    string | null; // "riser" | "impact" | "glitch" | "bell" | etc.
  // ── Real media populated by backend ──
  videoUrl?:       string | null; // Pexels HD .mp4 URL
  thumbUrl?:       string | null; // Pexels video cover image URL
  sfxPreviewUrl?:  string | null; // Freesound .mp3 preview URL
  videoOptions?:   Array<{ url: string; thumb: string; query: string }>; // alternatives
}

// ─── SFX Scoring Layer ────────────────────────────────────────────────────────
export interface SFXMarker {
  id: string;
  type: "transition" | "emphasis";
  timeSec: number;      // global position in seconds
  label: string;        // tooltip text (e.g. "Caixa Registradora")
  kind: "zap" | "bell"; // zap = whoosh/impact, bell = chime/ding
  color: string;
  keyword?: string;     // which keyword triggered this
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WinningAd {
  id: string;
  title: string;
  niche: string;
  daysActive: string;
  thumbnailUrl: string;
  videoUrl?: string | null;
  hookText: string;
  views: string;
  spend: string;
}

export type IntentResult = {
  emotion: string;
  searchQueries: string[];
  suggestedSfx: string | null;
};
