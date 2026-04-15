// ─── /api/credits ─────────────────────────────────────────────────────────────
// GET  → retorna créditos e plano do usuário
// POST → debita créditos atomicamente (Supabase RPC com row lock)
import { NextRequest, NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost, CostMeta } from "@/app/lib/creditCost";
import { sendWelcomeEmail } from "@/app/lib/emails";
import { rateLimit } from "@/app/lib/rateLimit";

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
    if (user.email) sendWelcomeEmail(user.email, user.user_metadata?.full_name);
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

// ── POST: debita créditos atomicamente via RPC ────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 60 débitos/min por usuário (generoso, cobre uso legítimo)
  const ok = await rateLimit(`credits:debit:${user.id}`, 60, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  const { action, chars, duration } = await req.json() as { action: string } & CostMeta;
  if (!action) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const cost = computeCost(action, { chars, duration });
  if (cost <= 0) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  // Garante que o perfil existe (primeiro uso)
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    await supabaseAdmin.from("profiles").upsert(
      { id: user.id, email: user.email, credits: FREE_INITIAL_CREDITS, plan: "free" },
      { onConflict: "id" }
    );
  }

  // Débito atômico via RPC — retorna null se saldo insuficiente
  const { data: newBalance, error: rpcErr } = await supabaseAdmin
    .rpc("debit_credits", { p_user_id: user.id, p_amount: cost });

  if (rpcErr) {
    // Se a constraint CHECK (credits >= 0) foi violada por corrida residual,
    // tratamos como saldo insuficiente.
    const msg = rpcErr.message || "";
    if (msg.includes("profiles_credits_nonnegative") || msg.includes("check constraint")) {
      return NextResponse.json({
        error: "Créditos insuficientes", code: "INSUFFICIENT_CREDITS", required: cost,
      }, { status: 402 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (newBalance === null) {
    // Saldo insuficiente — busca saldo atual pra informar o cliente
    const { data: cur } = await supabaseAdmin
      .from("profiles").select("credits").eq("id", user.id).single();
    return NextResponse.json({
      error:    "Créditos insuficientes",
      code:     "INSUFFICIENT_CREDITS",
      credits:  cur?.credits ?? 0,
      required: cost,
    }, { status: 402 });
  }

  return NextResponse.json({ ok: true, credits: newBalance, spent: cost });
}
