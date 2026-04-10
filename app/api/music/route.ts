// ─── /api/music ── Gera música ou SFX via MiniMax Music API ──────────────────
// POST https://api.minimax.io/v1/music_generation
// Returns: audio blob (mp3) direto
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost } from "@/app/lib/creditCost";
import { rateLimit } from "@/app/lib/rateLimit";

export const maxDuration = 120;

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;
const MINIMAX_MUSIC_ENDPOINT = "https://api.minimax.io/v1/music_generation";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Rate limit: 10 music/sfx calls per user per minute ───────────────────
  if (!await rateLimit(`music:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  const {
    prompt,
    type     = "music",  // "music" | "sfx"
    duration = 30,        // segundos
    mood,
  } = await req.json() as {
    prompt:  string;
    type?:   string;
    duration?: number;
    mood?:   string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt é obrigatório" }, { status: 400 });
  }

  // ── Server-side credit check + deduction ─────────────────────────────────
  const action = type === "sfx" ? "sfx" : "music";
  const cost = computeCost(action, { duration });
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

  // Enrich prompt with mood and type
  const enrichedPrompt = [
    mood ? `[${mood}]` : "",
    prompt.trim(),
    type === "sfx" ? "(sound effect)" : "(background music)",
  ].filter(Boolean).join(" ");

  // MiniMax music-01 model request body
  // Using simple format without extra audio_settings
  const body = {
    model: "music-01",
    prompt: enrichedPrompt,
    duration: Math.max(5, Math.min(60, duration || 30)),
  };

  // Create abort controller with 110 second timeout (maxDuration is 120)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 110000);

  try {
    const res = await fetch(MINIMAX_MUSIC_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[/api/music] MiniMax HTTP error:", res.status, err);
      return NextResponse.json({ error: `MiniMax error ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const base = data?.base_resp;

    if (base?.status_code !== 0) {
      console.error("[/api/music] API error:", base);
      return NextResponse.json(
        { error: `MiniMax: ${base?.status_msg ?? "erro"} (${base?.status_code})` },
        { status: 502 },
      );
    }

    // Extract audio from response (could be hex or base64)
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
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[/api/music] Request timeout after 110 seconds");
      return NextResponse.json(
        { error: "Requisição de música expirou. Tente com uma descrição mais curta." },
        { status: 504 },
      );
    }
    // Refund credits on unexpected error
    await supabaseAdmin.from("profiles")
      .update({ credits: currentCredits }).eq("id", user.id);
    console.error("[/api/music] Unexpected error:", err);
    throw err;
  }
}
