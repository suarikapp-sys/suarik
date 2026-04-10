// ─── /api/voiceclone/poll ── Verifica status do clone de voz ─────────────────
// status: 1=queued 2=processing 3=done 4=failed
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

  const { taskId } = await req.json() as { taskId: string };
  if (!taskId) return NextResponse.json({ error: "taskId obrigatório" }, { status: 400 });

  // ── Poll Newport AI ────────────────────────────────────────────────────────
  const res = await fetch(`${NEWPORT_BASE}/api/getAsyncResult`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ taskId }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[voiceclone/poll] HTTP error:", res.status, errText.slice(0, 200));
    return NextResponse.json({ error: `Newport AI poll HTTP ${res.status}` }, { status: 502 });
  }

  const data = await res.json() as {
    code:    number;
    message: string;
    data?: {
      task: {
        taskId:      string;
        status:      number;
        errorMsg?:   string;
        failReason?: string;
        error?:      string;
        reason?:     string;
      };
      voices?: { voiceId: string; voiceName: string }[];
    };
  };

  if (data.code !== 0) {
    console.error("[voiceclone/poll] code != 0 — taskId:", taskId, "response:", JSON.stringify(data));
    return NextResponse.json({ error: data.message ?? "Erro ao verificar status" }, { status: 500 });
  }

  const status  = data.data?.task?.status ?? 1;
  const voiceId = data.data?.voices?.[0]?.voiceId ?? null;
  const task    = data.data?.task;

  // Extract error reason from any field Newport AI might use
  const reason =
    task?.errorMsg    ??
    task?.failReason  ??
    task?.error       ??
    task?.reason      ??
    (status === 4 ? data.message : null) ??
    null;

  if (status === 4) {
    console.error("[voiceclone/poll] Job FAILED — taskId:", taskId, "reason:", reason, "full task:", JSON.stringify(task), "full data:", JSON.stringify(data));
  }

  return NextResponse.json({ status, voiceId, taskId, reason });
}
