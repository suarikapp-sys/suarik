// ─── /api/voiceclone ── Clona uma voz via Newport AI ─────────────────────────
// POST https://api.newportai.com/api/async/voice-clone
// Body: { audioUrl, voiceName }
// Returns: { taskId }
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";

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

  const { audioUrl, voiceName } = await req.json() as {
    audioUrl:  string;
    voiceName: string;
  };

  if (!audioUrl || !voiceName) {
    return NextResponse.json({ error: "audioUrl e voiceName são obrigatórios" }, { status: 400 });
  }

  // ── Call Newport AI ────────────────────────────────────────────────────────
  const res = await fetch(`${NEWPORT_BASE}/api/async/voice-clone`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ audioUrl, voiceName }),
  });

  const data = await res.json() as { code: number; message: string; data?: { taskId: string } };

  if (data.code !== 0 || !data.data?.taskId) {
    console.error("[voiceclone] Newport AI error:", data);
    return NextResponse.json({ error: data.message ?? "Erro ao iniciar clonagem" }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
