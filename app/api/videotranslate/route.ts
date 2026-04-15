// ─── /api/videotranslate ── Tradução de vídeo com LipSync via Newport AI ──────
// POST https://api.newportai.com/api/async/video-translate
// Body: { videoUrl, targetLanguage }
// Returns: { taskId }
import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";
import { creditGuard }               from "@/app/lib/creditGuard";
import { rateLimit }                 from "@/app/lib/rateLimit";

const NEWPORT_BASE = "https://api.newportai.com";
const API_KEY      = process.env.DREAMFACE_API_KEY!;

export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", label: "Português BR" },
  { code: "en",    label: "English"      },
  { code: "es",    label: "Español"      },
  { code: "fr",    label: "Français"     },
  { code: "de",    label: "Deutsch"      },
  { code: "it",    label: "Italiano"     },
  { code: "ja",    label: "Japanese"     },
  { code: "zh",    label: "Chinese"      },
  { code: "ko",    label: "Korean"       },
  { code: "ar",    label: "Arabic"       },
];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase    = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await rateLimit(`videotranslate:${user.id}`, 5, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  const { videoUrl, targetLanguage } = await req.json() as {
    videoUrl:       string;
    targetLanguage: string;
  };

  if (!videoUrl || !targetLanguage) {
    return NextResponse.json({ error: "videoUrl e targetLanguage são obrigatórios" }, { status: 400 });
  }

  // ── Credits ────────────────────────────────────────────────────────────────
  const guard = await creditGuard(user.id, "videotranslate");
  if (guard.error) return guard.error;

  const res = await fetch(`${NEWPORT_BASE}/api/async/video-translate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body:    JSON.stringify({ videoUrl, targetLanguage }),
  });

  const data = await res.json() as { code: number; message: string; data?: { taskId: string } };

  if (data.code !== 0 || !data.data?.taskId) {
    console.error("[videotranslate] error:", data);
    await guard.refund();
    return NextResponse.json({ error: data.message ?? "Erro ao iniciar tradução" }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId, cost: guard.cost });
}
