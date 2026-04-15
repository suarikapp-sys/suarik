// ─── /api/admin/test-voices ───────────────────────────────────────────────────
// Testa cada voz do TTS_VOICES contra a API do MiniMax e reporta quais são válidas.
// USO: GET /api/admin/test-voices?lang=PT   (filtra por idioma, default: todos)
//      GET /api/admin/test-voices?lang=ALL
// ⚠️  Apenas para uso em desenvolvimento — remove ou protege antes de ir para produção.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { TTS_VOICES } from "@/app/lib/ttsVoices";
import { requireAdmin } from "@/app/lib/admin";

const MINIMAX_API_KEY  = process.env.MINIMAX_API_KEY!;
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/t2a_v2";
const TEST_TEXT        = "Teste.";   // texto mínimo para economizar créditos

export const maxDuration = 60;

async function testVoice(voiceId: string): Promise<{ valid: boolean; statusCode: number; msg: string }> {
  try {
    const res = await fetch(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: "speech-2.8-hd",
        text:  TEST_TEXT,
        stream: false,
        output_format: "hex",
        voice_setting: { voice_id: voiceId, speed: 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 16000, bitrate: 64000, format: "mp3", channel: 1 },
      }),
    });

    if (!res.ok) return { valid: false, statusCode: res.status, msg: `HTTP ${res.status}` };

    const data = await res.json();
    const code: number = data?.base_resp?.status_code ?? -1;
    const msg:  string = data?.base_resp?.status_msg  ?? "unknown";

    return { valid: code === 0, statusCode: code, msg };
  } catch (e) {
    return { valid: false, statusCode: -1, msg: e instanceof Error ? e.message : "timeout" };
  }
}

export async function GET(req: NextRequest) {
  // ── Admin auth ─────────────────────────────────────────────────────────────
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  if (!MINIMAX_API_KEY) {
    return NextResponse.json({ error: "MINIMAX_API_KEY não configurada" }, { status: 500 });
  }

  const lang = req.nextUrl.searchParams.get("lang")?.toUpperCase() ?? "PT";
  const voices = lang === "ALL"
    ? [...TTS_VOICES]
    : TTS_VOICES.filter(v => v.lang === lang);

  if (voices.length === 0) {
    return NextResponse.json({ error: `Nenhuma voz para lang=${lang}` }, { status: 400 });
  }

  const results: { id: string; label: string; lang: string; valid: boolean; code: number; msg: string }[] = [];

  // Testa em paralelo (máx 5 simultâneos para não estourar rate limit)
  const CHUNK = 5;
  for (let i = 0; i < voices.length; i += CHUNK) {
    const chunk = voices.slice(i, i + CHUNK);
    const chunkResults = await Promise.all(
      chunk.map(async v => {
        const r = await testVoice(v.id);
        return { id: v.id, label: v.label, lang: v.lang, ...r, code: r.statusCode };
      })
    );
    results.push(...chunkResults);
  }

  const valid   = results.filter(r => r.valid);
  const invalid = results.filter(r => !r.valid);

  return NextResponse.json({
    summary: { total: results.length, valid: valid.length, invalid: invalid.length },
    valid:   valid.map(r => r.id),
    invalid: invalid.map(r => ({ id: r.id, code: r.code, msg: r.msg })),
    details: results,
  }, {
    headers: { "Content-Type": "application/json" },
  });
}
