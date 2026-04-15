// ─── /api/dreamface ── Inicia job de LipSync na Newport AI ──────────────────
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";
import { creditGuard }               from "@/app/lib/creditGuard";
import { rateLimit }                 from "@/app/lib/rateLimit";

const NEWPORT_BASE = "https://api.newportai.com";
const API_KEY      = process.env.DREAMFACE_API_KEY!;

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase    = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 5 gerações/min/usuário
  if (!(await rateLimit(`lipsync:${user.id}`, 5, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  // ── Body ────────────────────────────────────────────────────────────────
  const body = await req.json() as {
    srcVideoUrl:   string;
    audioUrl:      string;
    vocalAudioUrl?: string;
    videoEnhance?:  number;   // 0 or 1
    fps?:           string;   // "original" | default 25
  };

  if (!body.srcVideoUrl || !body.audioUrl) {
    return NextResponse.json({ error: "srcVideoUrl e audioUrl são obrigatórios" }, { status: 400 });
  }

  // ── Credits ─────────────────────────────────────────────────────────────
  const guard = await creditGuard(user.id, "lipsync");
  if (guard.error) return guard.error;

  // ── Call Newport AI ─────────────────────────────────────────────────────
  const payload: Record<string, unknown> = {
    srcVideoUrl: body.srcVideoUrl,
    audioUrl:    body.audioUrl,
    videoParams: {
      video_width:   0,               // 0 = mantém resolução original
      video_height:  0,
      video_enhance: body.videoEnhance ?? 1,
      ...(body.fps ? { fps: body.fps } : {}),
    },
  };

  if (body.vocalAudioUrl) payload.vocalAudioUrl = body.vocalAudioUrl;

  const res = await fetch(`${NEWPORT_BASE}/api/async/lipsync`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json() as { code: number; message: string; data?: { taskId: string } };

  if (data.code !== 0 || !data.data?.taskId) {
    console.error("[dreamface] Newport AI error:", data);
    await guard.refund();
    return NextResponse.json({ error: data.message ?? "Erro ao iniciar LipSync" }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId, cost: guard.cost });
}
