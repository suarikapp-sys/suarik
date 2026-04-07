// ─── /api/dreamact/poll ── Polling do DreamAct (mesmo endpoint Newport) ───────
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

  const { taskId } = await req.json() as { taskId: string };
  if (!taskId) return NextResponse.json({ error: "taskId obrigatório" }, { status: 400 });

  const res = await fetch(`${NEWPORT_BASE}/api/getAsyncResult`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body:    JSON.stringify({ taskId }),
  });

  const data = await res.json() as {
    code:  number;
    message: string;
    data?: {
      task:    { taskId: string; status: number };
      videos?: { videoUrl: string }[];
    };
  };

  if (data.code !== 0) {
    return NextResponse.json({ error: data.message ?? "Erro ao verificar status" }, { status: 500 });
  }

  const status   = data.data?.task?.status ?? 1;
  const videoUrl = data.data?.videos?.[0]?.videoUrl ?? null;

  return NextResponse.json({ status, videoUrl, taskId });
}
