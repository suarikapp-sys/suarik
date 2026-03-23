import { NextRequest, NextResponse } from "next/server";

// GET /api/suggest-media?q=keyword&page=2
// Returns up to 6 Pexels HD video clips for the given search term.
export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get("q") ?? "cinematic broll";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const key  = process.env.PEXELS_API_KEY;

  if (!key) return NextResponse.json({ error: "API key missing" }, { status: 500 });

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=6&page=${page}&orientation=landscape`,
      { headers: { Authorization: key }, next: { revalidate: 60 } }
    );

    if (!res.ok) return NextResponse.json({ error: "Pexels error" }, { status: 502 });

    interface PexelsFile { quality: string; link: string; width: number; }
    interface PexelsVideo { id: number; image: string; video_files: PexelsFile[]; }
    const data = await res.json() as { videos?: PexelsVideo[] };

    const videos = (data.videos ?? [])
      .map((v) => {
        const hd = v.video_files?.find(f => f.quality === "hd" && f.width >= 1280)
                ?? v.video_files?.find(f => f.quality === "hd")
                ?? v.video_files?.find(f => f.quality === "sd")
                ?? v.video_files?.[0];
        return { url: hd?.link ?? "", thumb: v.image };
      })
      .filter(v => v.url);

    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
