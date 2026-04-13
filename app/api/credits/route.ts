// ─── /api/credits ─────────────────────────────────────────────────────────────
// GET  → retorna créditos e plano do usuário
// POST → debita créditos (ação atômica via RPC)
import { NextRequest, NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost, CostMeta } from "@/app/lib/creditCost";
import { sendWelcomeEmail } from "@/app/lib/emails";

// Admin client para RPC (bypassa RLS)
const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FREE_INITIAL_CREDITS = 100;

// ── GET: retorna créditos atuais (cria perfil se for primeiro acesso) ─────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("credits, plan, subscription_status")
    .eq("id", user.id)
    .single();

  // New user — profile row doesn't exist yet; create it with free credits
  if (error?.code === "PGRST116" || !data) {
    const { data: newProfile, error: insertErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id:      user.id,
        email:   user.email,
        credits: FREE_INITIAL_CREDITS,
        plan:    "free",
        subscription_status: "inactive",
      }, { onConflict: "id" })
      .select("credits, plan, subscription_status")
      .single();

    if (insertErr || !newProfile) {
      return NextResponse.json({ credits: FREE_INITIAL_CREDITS, plan: "free", status: "inactive" });
    }
    // Fire welcome email — non-blocking
    if (user.email) {
      sendWelcomeEmail(user.email, user.user_metadata?.full_name);
    }
    return NextResponse.json({
      credits: newProfile.credits ?? FREE_INITIAL_CREDITS,
      plan:    newProfile.plan    ?? "free",
      status:  newProfile.subscription_status ?? "inactive",
    });
  }

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  return NextResponse.json({
    credits: data.credits ?? 0,
    plan:    data.plan    ?? "free",
    status:  data.subscription_status ?? "inactive",
  });
}

// ── POST: verifica e debita créditos ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, chars, duration } = await req.json() as { action: string } & CostMeta;
  if (!action) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const cost = computeCost(action, { chars, duration });

  // Busca créditos atuais
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (fetchErr?.code === "PGRST116" || !profile) {
    // New user with no profile — auto-create with free credits
    await supabaseAdmin.from("profiles").upsert(
      { id: user.id, email: user.email, credits: FREE_INITIAL_CREDITS, plan: "free" },
      { onConflict: "id" }
    );
    // Check if they can afford after creation
    if (FREE_INITIAL_CREDITS < cost) {
      return NextResponse.json({
        error: "Créditos insuficientes", code: "INSUFFICIENT_CREDITS",
        credits: FREE_INITIAL_CREDITS, required: cost,
      }, { status: 402 });
    }
    // Debit immediately
    await supabaseAdmin.from("profiles")
      .update({ credits: FREE_INITIAL_CREDITS - cost })
      .eq("id", user.id);
    return NextResponse.json({ ok: true, credits: FREE_INITIAL_CREDITS - cost, spent: cost });
  }
  if (fetchErr) {
    return NextResponse.json({ error: (fetchErr as { message: string }).message }, { status: 500 });
  }

  const current = profile.credits ?? 0;

  if (current < cost) {
    return NextResponse.json({
      error:    "Créditos insuficientes",
      code:     "INSUFFICIENT_CREDITS",
      credits:  current,
      required: cost,
    }, { status: 402 });
  }

  // Debita atomicamente
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ credits: current - cost })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok:      true,
    credits: current - cost,
    spent:   cost,
  });
}
