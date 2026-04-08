// ─── /api/tts/preview ─────────────────────────────────────────────────────────
// Gera um áudio curto de demonstração para preview de voz.
// Não consome créditos — apenas autenticação básica.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TTS_VOICES } from "../../../lib/ttsVoices";

export const maxDuration = 30;

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/t2a_v2";
const PREVIEW_TEXT = "A minha voz é profissional e clara.";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!MINIMAX_API_KEY) {
    return NextResponse.json({ error: "MINIMAX_API_KEY não configurada" }, { status: 500 });
  }

  const { voiceId } = await req.json() as { voiceId: string };

  const validVoice = TTS_VOICES.find((v: { id: string }) => v.id === voiceId);
  if (!validVoice) {
    return NextResponse.json({ error: `Voz "${voiceId}" não encontrada` }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let res: Response;
  try {
    res = await fetch(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "speech-2.8-hd",
        text: PREVIEW_TEXT,
        stream: false,
        language_boost: "auto",
        output_format: "hex",
        voice_setting: {
          voice_id: voiceId,
          speed: 1.0,
          vol: 1.0,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1,
        },
      }),
    });
    clearTimeout(timeoutId);
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
      return NextResponse.json({ error: "Preview expirou. Tente novamente." }, { status: 504 });
    }
    throw fetchErr;
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[/api/tts/preview] MiniMax HTTP error:", res.status, err);
    return NextResponse.json({ error: `MiniMax error ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  const base = data?.base_resp;
  if (base?.status_code !== 0) {
    return NextResponse.json(
      { error: `MiniMax: ${base?.status_msg ?? "erro"} (${base?.status_code})` },
      { status: 502 },
    );
  }

  const audioHex: string = data?.data?.audio ?? data?.audio;
  if (!audioHex) {
    return NextResponse.json({ error: "Sem campo 'audio' na resposta" }, { status: 502 });
  }

  const audioBuffer = Buffer.from(audioHex, "hex");

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.length),
      "Cache-Control": "public, max-age=86400", // cache 24h
    },
  });
}
