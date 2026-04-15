// ─── /api/tts-cloned ── TTS com voz clonada via MiniMax ──────────────────────
// Uses a voice_id returned by /api/voiceclone (MiniMax) to generate speech.
// Returns MP3 audio blob directly.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";
import { creditGuard }               from "@/app/lib/creditGuard";
import { rateLimit }                 from "@/app/lib/rateLimit";

export const maxDuration = 60;

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/t2a_v2";

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

  if (!(await rateLimit(`tts-cloned:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

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

  // ── Credits (same formula as regular TTS) ──────────────────────────────────
  const guard = await creditGuard(user.id, "tts", { chars: text.length });
  if (guard.error) return guard.error;

  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 55000);

    const res = await fetch(MINIMAX_ENDPOINT, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type":  "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model:  "speech-2.8-hd",
        text:   text.trim(),
        stream: false,
        language_boost: "auto",
        output_format:  "hex",
        voice_setting: {
          voice_id: voiceId,
          speed:    Math.max(0.5, Math.min(2.0, speed)),
          vol:      1.0,
          pitch:    0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate:     128000,
          format:      "mp3",
          channel:     1,
        },
      }),
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[tts-cloned] MiniMax HTTP error:", res.status, errText);
      await guard.refund();
      return NextResponse.json({ error: `MiniMax TTS erro ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as {
      base_resp?: { status_code: number; status_msg: string };
      data?: { audio?: string; audioUrl?: string };
    };

    if (data.base_resp?.status_code !== 0) {
      const msg = data.base_resp?.status_msg ?? "Erro MiniMax TTS";
      console.error("[tts-cloned] MiniMax error:", msg, data);
      await guard.refund();
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    // Audio as hex string → Buffer → MP3 response
    const hexAudio = data.data?.audio;
    if (!hexAudio) {
      await guard.refund();
      return NextResponse.json({ error: "Resposta sem áudio" }, { status: 502 });
    }

    const audioBuffer = Buffer.from(hexAudio, "hex");
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type":   "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control":  "no-store",
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tts-cloned] Unexpected error:", msg);
    await guard.refund();
    if (msg.includes("AbortError") || msg.includes("abort")) {
      return NextResponse.json({ error: "Tempo limite excedido. Tenta com texto mais curto." }, { status: 504 });
    }
    return NextResponse.json({ error: "Erro interno no TTS clonado" }, { status: 500 });
  }
}
