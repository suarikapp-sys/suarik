// ─── /api/dreamact ── Avatar com movimento via Newport AI DreamAct ────────────
// POST https://api.newportai.com/api/async/dream-act
// Body: { imageUrl, prompt, duration? }
// Returns: { taskId }
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";
import { creditGuard }               from "@/app/lib/creditGuard";

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

  const { imageUrl, prompt, duration = 5 } = await req.json() as {
    imageUrl: string;
    prompt:   string;
    duration?: number;
  };

  if (!imageUrl || !prompt) {
    return NextResponse.json({ error: "imageUrl e prompt são obrigatórios" }, { status: 400 });
  }

  // ── Credits ────────────────────────────────────────────────────────────────
  const guard = await creditGuard(user.id, "dreamact");
  if (guard.error) return guard.error;

  const res = await fetch(`${NEWPORT_BASE}/api/async/dream-act`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body:    JSON.stringify({ imageUrl, prompt, duration: Math.max(2, Math.min(10, duration)) }),
  });

  const data = await res.json() as { code: number; message: string; data?: { taskId: string } };

  if (data.code !== 0 || !data.data?.taskId) {
    console.error("[dreamact] error:", data);
    await guard.refund();
    return NextResponse.json({ error: data.message ?? "Erro ao iniciar DreamAct" }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId, cost: guard.cost });
}
