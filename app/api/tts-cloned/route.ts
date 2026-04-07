// ─── /api/tts-cloned ── TTS com voz clonada via Newport AI ─────────────────────
// Usa um voiceId retornado pelo endpoint de voice-clone da Newport AI
// para gerar fala a partir de texto. Retorna áudio MP3.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";

export const maxDuration = 60;

const NEWPORT_BASE = "https://api.newportai.com";
const API_KEY      = process.env.DREAMFACE_API_KEY!;

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase    = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, voiceId, speed = 1.0 } = await req.json() as {
    text:    string;
    voiceId: string;
    speed?:  number;
  };

  if (!text?.trim() || !voiceId) {
    return NextResponse.json({ error: "text e voiceId são obrigatórios" }, { status: 400 });
  }

  if (text.length > 5000) {
    return NextResponse.json({ error: "Texto muito longo (máx 5.000 caracteres)" }, { status: 400 });
  }

  try {
    // Newport AI TTS endpoint for cloned voices
    const res = await fetch(`${NEWPORT_BASE}/api/tts`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        text:    text.trim(),
        voiceId: voiceId,
        speed:   Math.max(0.5, Math.min(2.0, speed)),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[tts-cloned] Newport AI HTTP error:", res.status, errText);

      // Fallback: tenta retornar erro útil
      return NextResponse.json(
        { error: `Newport AI TTS erro ${res.status}: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";

    // Se vier JSON, é uma resposta async (task)
    if (contentType.includes("application/json")) {
      const data = await res.json() as { code: number; message: string; data?: { audioUrl?: string; audio?: string } };

      if (data.code !== 0) {
        return NextResponse.json({ error: data.message ?? "Erro Newport AI TTS" }, { status: 502 });
      }

      // Se vier URL pública do áudio
      if (data.data?.audioUrl) {
        const audioRes = await fetch(data.data.audioUrl);
        const audioBlob = await audioRes.blob();
        const buf = Buffer.from(await audioBlob.arrayBuffer());
        return new NextResponse(buf, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      }

      // Se vier base64/hex
      if (data.data?.audio) {
        const buf = Buffer.from(data.data.audio, "hex");
        return new NextResponse(buf, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      }

      return NextResponse.json({ error: "Resposta sem campo 'audio' ou 'audioUrl'" }, { status: 502 });
    }

    // Se vier binário direto
    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type":   "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control":  "no-store",
      },
    });

  } catch (err) {
    console.error("[tts-cloned] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno no TTS clonado" }, { status: 500 });
  }
}
