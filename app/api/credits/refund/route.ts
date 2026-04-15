// ─── POST /api/credits/refund ─────────────────────────────────────────────────
// Devolve créditos quando uma operação falha após o débito.
// Proteções:
//   • Rate limit agressivo (10 refunds/min por usuário)
//   • Idempotency via refund_id obrigatório — RPC rejeita duplicatas
//   • Valor calculado server-side via computeCost (cliente não passa amount)
// ──────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost, CostMeta } from "@/app/lib/creditCost";
import { rateLimit } from "@/app/lib/rateLimit";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 refunds/min/usuário — legítimo raramente precisa mais
  const ok = await rateLimit(`refund:${user.id}`, 10, 60_000);
  if (!ok) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  const { action, meta, refundId } = await req.json() as {
    action: string; meta?: CostMeta; refundId?: string;
  };

  if (!action)   return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  if (!refundId) return NextResponse.json({ error: "refundId obrigatório" }, { status: 400 });
  if (typeof refundId !== "string" || refundId.length < 8 || refundId.length > 128) {
    return NextResponse.json({ error: "refundId inválido" }, { status: 400 });
  }

  const cost = computeCost(action, meta);
  if (!cost || cost <= 0) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  // Escopa o refund_id ao usuário pra impedir colisão entre contas
  const scopedRefundId = `${user.id}:${refundId}`;

  const { data: newBalance, error } = await supabaseAdmin.rpc("refund_credits", {
    p_user_id:   user.id,
    p_amount:    cost,
    p_action:    action,
    p_refund_id: scopedRefundId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // RPC retorna -1 quando refund_id já foi processado (idempotência)
  if (newBalance === -1) {
    const { data: cur } = await supabaseAdmin
      .from("profiles").select("credits").eq("id", user.id).single();
    return NextResponse.json({
      ok: true, alreadyRefunded: true, credits: cur?.credits ?? 0, refunded: 0,
    });
  }

  return NextResponse.json({ ok: true, credits: newBalance, refunded: cost });
}
