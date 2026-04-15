// ─── /api/account/export ── LGPD art. 18: data portability ───────────────────
// Returns a JSON dump of all data we hold for the authenticated user.
// Downloaded as suarik-export-<timestamp>.json.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { rateLimit } from "@/app/lib/rateLimit";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!(await rateLimit(`account:export:${user.id}`, 3, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  // Pull all user-scoped rows in parallel
  const [profileRes, projectsRes, voicesRes, refundsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabaseAdmin.from("projects").select("*").eq("user_id", user.id),
    supabaseAdmin.from("cloned_voices").select("*").eq("user_id", user.id),
    supabaseAdmin.from("credit_refunds").select("*").like("refund_id", `${user.id}:%`),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id:         user.id,
      email:      user.email,
      createdAt:  user.created_at,
      provider:   user.app_metadata?.provider,
    },
    profile:       profileRes.data ?? null,
    projects:      projectsRes.data ?? [],
    clonedVoices: (voicesRes.data ?? []).map(v => {
      const row = v as Record<string, unknown>;
      return { voice_id: row.voice_id, voice_name: row.voice_name, created_at: row.created_at };
    }),
    creditRefunds: refundsRes.data ?? [],
  };

  const filename = `suarik-export-${Date.now()}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type":        "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
