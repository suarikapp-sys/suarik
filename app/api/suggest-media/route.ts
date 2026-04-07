import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/suggest-media?q=keyword&page=2
// Returns up to 12 HD video clips — Pexels + Pixabay in parallel, interleaved.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const q       = req.nextUrl.searchParams.get("q") ?? "cinematic broll";
  const page    = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const pexKey  = process.env.PEXELS_API_KEY;
  const pixKey  = process.env.PIXABAY_API_KEY;

  if (!pexKey && !pixKey)
    return NextResponse.json({ error: "API keys missing" }, { status: 500 });

  interface VideoResult { url: string; thumb: string; source: string; }

  const [pexels, pixabay] = await Promise.all([
    // ── Pexels ───────────────────────────────────────────────────────────────
    pexKey
      ? fetch(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=6&page=${page}&orientation=landscape&min_width=1280`,
          { headers: { Authorization: pexKey }, next: { revalidate: 60 } }
        ).then(async res => {
          if (!res.ok) return [] as VideoResult[];
          interface PexFile { quality: string; link: string; width: number; }
          interface PexVideo { image: string; video_files: PexFile[]; }
          const data = await res.json() as { videos?: PexVideo[] };
          return (data.videos ?? []).flatMap(v => {
            const hd = v.video_files?.find(f => f.quality === "hd" && f.width >= 1920)
                    ?? v.video_files?.find(f => f.quality === "hd" && f.width >= 1280)
                    ?? v.video_files?.find(f => f.quality === "hd")
                    ?? v.video_files?.[0];
            if (!hd?.link) return [];
            return [{ url: hd.link, thumb: v.image ?? "", source: "Pexels" }];
          });
        }).catch(() => [] as VideoResult[])
      : Promise.resolve([] as VideoResult[]),

    // ── Pixabay ──────────────────────────────────────────────────────────────
    pixKey
      ? fetch(
          `https://pixabay.com/api/videos/?key=${pixKey}&q=${encodeURIComponent(q)}&per_page=6&page=${page}&video_type=film&min_width=1280`
        ).then(async res => {
          if (!res.ok) return [] as VideoResult[];
          interface PixHit {
            videos: {
              large?: { url: string };
              medium?: { url: string };
            };
            userImageURL: string;
          }
          const data = await res.json() as { hits?: PixHit[] };
          return (data.hits ?? []).flatMap(hit => {
            const url = hit.videos?.large?.url ?? hit.videos?.medium?.url;
            if (!url) return [];
            return [{ url, thumb: hit.userImageURL ?? "", source: "Pixabay" }];
          });
        }).catch(() => [] as VideoResult[])
      : Promise.resolve([] as VideoResult[]),
  ]);

  // Interleave: Pexels1, Pixabay1, Pexels2, Pixabay2, ...
  const videos: VideoResult[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(pexels.length, pixabay.length);
  for (let i = 0; i < maxLen; i++) {
    if (pexels[i] && !seen.has(pexels[i].url)) { seen.add(pexels[i].url); videos.push(pexels[i]); }
    if (pixabay[i] && !seen.has(pixabay[i].url)) { seen.add(pixabay[i].url); videos.push(pixabay[i]); }
  }

  return NextResponse.json({ videos: videos.slice(0, 12) });
}
