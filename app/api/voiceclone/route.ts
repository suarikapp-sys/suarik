// ─── /api/voiceclone ── Clona uma voz via MiniMax ────────────────────────────
// POST { audioUrl, voiceName }
// Downloads the audio from R2, uploads to MiniMax voice clone API,
// and returns { voiceId } synchronously (no polling needed).
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";
import { creditGuard }               from "@/app/lib/creditGuard";

export const maxDuration = 60;

const MINIMAX_API_KEY  = process.env.MINIMAX_API_KEY!;
const MINIMAX_BASE     = "https://api.minimax.io";

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

  const { audioUrl, voiceName: rawName } = await req.json() as {
    audioUrl:  string;
    voiceName: string;
  };

  if (!audioUrl || !rawName) {
    return NextResponse.json({ error: "audioUrl e voiceName são obrigatórios" }, { status: 400 });
  }

  // MiniMax voice IDs: alphanumeric + underscore, max 40 chars
  // Add short timestamp suffix to guarantee uniqueness across clones
  const baseId = rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 28) || "voice";
  const voiceName = `${baseId}_${Date.now().toString(36)}`; // e.g. "Minha_Voz_m5x3k2"

  // ── Validate audioUrl ─────────────────────────────────────────────────────
  try {
    const parsed = new URL(audioUrl);
    if (parsed.protocol !== "https:") throw new Error("URL deve ser HTTPS");
  } catch {
    return NextResponse.json({ error: `audioUrl inválido` }, { status: 400 });
  }

  // ── Credits ────────────────────────────────────────────────────────────────
  const guard = await creditGuard(user.id, "voiceclone");
  if (guard.error) return guard.error;

  try {
    // ── Step 1: Download audio from R2 ────────────────────────────────────
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(20000) });
    if (!audioRes.ok) {
      await guard.refund();
      return NextResponse.json({ error: `Não foi possível baixar o áudio (HTTP ${audioRes.status})` }, { status: 400 });
    }
    const audioBuffer  = await audioRes.arrayBuffer();
    const contentType  = audioRes.headers.get("content-type") || "audio/mpeg";
    const ext = contentType.includes("wav")  ? "wav"
              : contentType.includes("mpeg") ? "mp3"
              : contentType.includes("mp4")  ? "mp4"
              : contentType.includes("webm") ? "webm"
              : "mp3";

    // ── Step 2: Upload to MiniMax file service ────────────────────────────
    const uploadForm = new FormData();
    uploadForm.append("file", new Blob([audioBuffer], { type: contentType }), `sample.${ext}`);
    uploadForm.append("purpose", "voice_clone");

    const uploadRes = await fetch(`${MINIMAX_BASE}/v1/files/upload`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${MINIMAX_API_KEY}` },
      body:    uploadForm,
      signal:  AbortSignal.timeout(30000),
    });
    const uploadData = await uploadRes.json() as {
      file?: { file_id: string };
      base_resp?: { status_code: number; status_msg: string };
    };

    const fileId = uploadData.file?.file_id;
    if (!fileId) {
      await guard.refund();
      const errMsg = uploadData.base_resp?.status_msg ?? "Falha ao fazer upload para MiniMax";
      return NextResponse.json({ error: errMsg, debug: uploadData }, { status: 500 });
    }

    // ── Step 3: Clone voice using file_id ─────────────────────────────────
    const res = await fetch(`${MINIMAX_BASE}/v1/voice_clone`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${MINIMAX_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body:   JSON.stringify({ file_id: fileId, voice_id: voiceName }),
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json() as {
      voice_id?: string;
      base_resp?: { status_code: number; status_msg: string };
      // alternate field names
      voiceId?:   string;
      code?:      number;
      message?:   string;
    };


    // MiniMax uses base_resp.status_code = 0 for success
    const statusCode = data.base_resp?.status_code ?? data.code ?? -1;

    if (statusCode !== 0) {
      const errMsg = data.base_resp?.status_msg ?? data.message ?? "Erro ao clonar voz";
      console.error("[voiceclone] MiniMax rejected:", data);
      await guard.refund();
      return NextResponse.json({ error: errMsg, debug: data }, { status: 500 });
    }

    // MiniMax success: the voice_id is the one WE sent — no separate field returned
    const voiceId = data.voice_id ?? data.voiceId ?? voiceName;
    return NextResponse.json({ voiceId, cost: guard.cost });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[voiceclone] Unexpected error:", msg);
    await guard.refund();
    return NextResponse.json({ error: "Erro interno ao clonar voz" }, { status: 500 });
  }
}
