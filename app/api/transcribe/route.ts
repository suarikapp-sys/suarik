import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Vercel Hobby = max 60s. Whisper processing needs time for long audio.
export const maxDuration = 60;

const WHISPER_LIMIT = 25 * 1024 * 1024; // 25 MB — Whisper hard limit
const SAFE_LIMIT   = 24 * 1024 * 1024; // 24 MB — safe margin

// ─── POST /api/transcribe ───────────────────────────────────────────────────
// Accepts EITHER:
//   A) JSON body { publicUrl } → downloads video from R2, sends to Whisper
//   B) FormData with "audio" file → sends audio blob directly to Whisper
// For videos > 25MB (Mode A), downloads only the first 24MB using Range header.
// Whisper can still transcribe partial files — it processes whatever audio it gets.
// Returns: { text, words: [{ word, start, end }] }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    let audioBlob: Blob;
    let audioName = "audio.webm";

    const ct = req.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      // ── Mode B: Frontend sent audio directly via FormData ──────────────
      const formData = await req.formData();
      const file = formData.get("audio");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "Campo 'audio' ausente no FormData." },
          { status: 400 },
        );
      }
      if (file.size > WHISPER_LIMIT) {
        return NextResponse.json(
          { error: "Áudio excede 25 MB (limite do Whisper)." },
          { status: 413 },
        );
      }
      audioBlob = file;
      audioName = (file instanceof File ? file.name : null) ?? "audio.webm";
    } else {
      // ── Mode A: JSON body with publicUrl — download from R2 ───────────
      const body = await req.json();
      const { publicUrl } = body as { publicUrl?: string };
      if (!publicUrl) {
        return NextResponse.json(
          { error: "Missing 'publicUrl' or 'audio' FormData." },
          { status: 400 },
        );
      }

      // First, check the file size with a HEAD request
      let fileSize = 0;
      try {
        const headRes = await fetch(publicUrl, { method: "HEAD" });
        if (headRes.ok) {
          fileSize = parseInt(headRes.headers.get("content-length") ?? "0", 10);
        }
      } catch { /* ignore, will try full download */ }


      let buf: ArrayBuffer;

      if (fileSize > 0 && fileSize <= WHISPER_LIMIT) {
        // ── Small enough: download entire file ──
        const videoRes = await fetch(publicUrl);
        if (!videoRes.ok) {
          return NextResponse.json(
            { error: `Download do vídeo falhou: ${videoRes.status}` },
            { status: 502 },
          );
        }
        buf = await videoRes.arrayBuffer();
      } else if (fileSize > WHISPER_LIMIT) {
        // ── Too large: download only first 24MB using Range header ──
        const videoRes = await fetch(publicUrl, {
          headers: { Range: `bytes=0-${SAFE_LIMIT - 1}` },
        });
        if (!videoRes.ok && videoRes.status !== 206) {
          return NextResponse.json(
            { error: `Download parcial falhou: ${videoRes.status}` },
            { status: 502 },
          );
        }
        buf = await videoRes.arrayBuffer();
      } else {
        // ── Unknown size: try full download, truncate if needed ──
        const videoRes = await fetch(publicUrl);
        if (!videoRes.ok) {
          return NextResponse.json(
            { error: `Download do vídeo falhou: ${videoRes.status}` },
            { status: 502 },
          );
        }
        const fullBuf = await videoRes.arrayBuffer();
        buf = fullBuf.byteLength > WHISPER_LIMIT
          ? fullBuf.slice(0, SAFE_LIMIT)
          : fullBuf;
      }

      audioBlob = new Blob([buf], { type: "video/mp4" });
      audioName = "video.mp4";
    }

    // ── Send to Whisper ─────────────────────────────────────────────────
    const whisperForm = new FormData();
    whisperForm.append("file", new File([audioBlob], audioName, { type: audioBlob.type || "audio/webm" }));
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "verbose_json");
    whisperForm.append("timestamp_granularities[]", "word");


    const whisperRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperForm,
      },
    );

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("[transcribe] Whisper error:", errText);
      return NextResponse.json(
        { error: `Whisper API error: ${whisperRes.status}`, details: errText },
        { status: whisperRes.status },
      );
    }

    const result = await whisperRes.json();


    return NextResponse.json({
      text: result.text ?? "",
      words: (result.words ?? []).map(
        (w: { word: string; start: number; end: number }) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        }),
      ),
    });
  } catch (err: unknown) {
    console.error("[transcribe] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
