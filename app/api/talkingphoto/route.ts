// ─── /api/talkingphoto ── Foto falante via Newport AI ────────────────────────
// POST https://api.newportai.com/api/async/talking-photo
// Body: { imageUrl, audioUrl }
// Returns: { taskId }
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";

const NEWPORT_BASE = "https://api.newportai.com";
const API_KEY      = process.env.DREAMFACE_API_KEY!;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase    = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageUrl, audioUrl } = await req.json() as {
    imageUrl: string;
    audioUrl: string;
  };

  if (!imageUrl || !audioUrl) {
    return NextResponse.json({ error: "imageUrl e audioUrl são obrigatórios" }, { status: 400 });
  }

  const res = await fetch(`${NEWPORT_BASE}/api/async/talking-photo`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body:    JSON.stringify({ imageUrl, audioUrl }),
  });

  const data = await res.json() as { code: number; message: string; data?: { taskId: string } };

  if (data.code !== 0 || !data.data?.taskId) {
    console.error("[talkingphoto] error:", data);
    return NextResponse.json({ error: data.message ?? "Erro ao iniciar Talking Photo" }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
