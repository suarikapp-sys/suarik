import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ArchiveFile {
  name: string;
  title?: string;
  creator?: string;
  length?: string;
  format?: string;
}

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "ambient";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const offset = (page - 1) * 12;

  try {
    // Step 1: Search Archive.org for audio items
    const searchUrl = new URL("https://archive.org/advancedsearch.php");
    searchUrl.searchParams.set("q", `mediatype:audio AND ${q}`);
    searchUrl.searchParams.set("fl[]", "identifier,title,creator");
    searchUrl.searchParams.set("sort[]", "downloads desc");
    searchUrl.searchParams.set("rows", "6");
    searchUrl.searchParams.set("start", String(offset));
    searchUrl.searchParams.set("output", "json");

    const searchRes = await fetch(searchUrl.toString(), { next: { revalidate: 300 } });
    if (!searchRes.ok) throw new Error("Archive search failed");
    const searchData = await searchRes.json();
    const docs: ArchiveDoc[] = searchData?.response?.docs ?? [];

    if (docs.length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // Step 2: Fetch metadata for each item in parallel, take up to 2 mp3s per item
    const metaResults = await Promise.all(
      docs.slice(0, 6).map(async (doc) => {
        try {
          const metaRes = await fetch(
            `https://archive.org/metadata/${doc.identifier}`,
            { next: { revalidate: 300 } }
          );
          if (!metaRes.ok) return [];
          const meta = await metaRes.json();
          const mp3s: ArchiveFile[] = (meta.files ?? []).filter(
            (f: ArchiveFile) =>
              f.name?.toLowerCase().endsWith(".mp3") &&
              !f.name.includes("/") // skip files in subdirectories
          );
          return mp3s.slice(0, 2).map((f) => ({
            id: `${doc.identifier}/${f.name}`,
            name: f.title || f.name.replace(/\.mp3$/i, ""),
            artist_name: Array.isArray(doc.creator)
              ? doc.creator[0]
              : doc.creator || "Unknown",
            audio: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(f.name)}`,
            duration: f.length ? Math.round(parseFloat(f.length)) : 0,
          }));
        } catch {
          return [];
        }
      })
    );

    const results = metaResults.flat().slice(0, 12);
    const total = searchData?.response?.numFound ?? results.length;

    return NextResponse.json({ results, total });
  } catch (e) {
    console.error("music-library error", e);
    return NextResponse.json({ results: [], total: 0 }, { status: 200 });
  }
}
