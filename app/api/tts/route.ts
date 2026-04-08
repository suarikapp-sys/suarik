// ─── /api/tts ──────────────────────────────────────────────────────────────────
// Converte texto em áudio MP3 usando a API MiniMax TTS.
// Retorna o áudio como blob MP3 diretamente (Content-Type: audio/mpeg).
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost } from "@/app/lib/creditCost";
import { rateLimit } from "@/app/lib/rateLimit";

export const maxDuration = 60;

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/t2a_v2";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

import { TTS_VOICES } from "../../lib/ttsVoices";
export type { TTSVoiceId } from "../../lib/ttsVoices";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Rate limit: 15 TTS calls per user per minute ──────────────────────────
  if (!rateLimit(`tts:${user.id}`, 15, 60_000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  if (!MINIMAX_API_KEY) {
    return NextResponse.json({ error: "MINIMAX_API_KEY não configurada" }, { status: 500 });
  }

  const {
    text,
    voiceId   = "English_expressive_narrator",
    speed     = 1.0,
    vol       = 1.0,
    pitch     = 0,
    emotion,  // Not used - MiniMax doesn't support emotion parameter
  } = await req.json() as {
    text: string; voiceId?: string; speed?: number;
    vol?: number; pitch?: number; emotion?: string;
  };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Campo 'text' é obrigatório" }, { status: 400 });
  }

  if (text.length > 10000) {
    return NextResponse.json({ error: "Texto muito longo (máx 10.000 caracteres)" }, { status: 400 });
  }

  // ── Server-side credit check + deduction ─────────────────────────────────
  const cost = computeCost("tts", { chars: text.length });
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
    // Validate voice_id exists
    const validVoice = TTS_VOICES.find((v: { id: string }) => v.id === voiceId);
    if (!validVoice) {
      return NextResponse.json({ error: `Voice "${voiceId}" não existe` }, { status: 400 });
    }

    // Create an abort controller with 55 second timeout (maxDuration is 60)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

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
          text: text.trim(),
          stream: false,
          language_boost: "auto",
          output_format: "hex",
          voice_setting: {
            voice_id: voiceId,
            speed: Math.max(0.5, Math.min(2.0, speed)),
            vol: Math.max(0.1, Math.min(10.0, vol)),
            pitch: Math.max(-12, Math.min(12, pitch)),
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
        console.error("[/api/tts] Request timeout after 55 seconds");
        return NextResponse.json({ error: "Requisição expirou. Tente novamente com texto mais curto." }, { status: 504 });
      }
      throw fetchErr;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[/api/tts] MiniMax HTTP error:", res.status, err);
      return NextResponse.json({ error: `MiniMax error ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    const base = data?.base_resp;
    if (base?.status_code !== 0) {
      console.error("[/api/tts] MiniMax API error:", base);
      return NextResponse.json(
        { error: `MiniMax: ${base?.status_msg ?? "erro desconhecido"} (${base?.status_code})` },
        { status: 502 },
      );
    }

    const audioHex: string = data?.data?.audio ?? data?.audio;
    if (!audioHex) {
      return NextResponse.json({ error: "Resposta sem campo 'audio'" }, { status: 502 });
    }

    const audioBuffer = Buffer.from(audioHex, "hex");

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    // Refund credits on unexpected error
    await supabaseAdmin.from("profiles")
      .update({ credits: currentCredits }).eq("id", user.id);
    console.error("[/api/tts] Unexpected error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
