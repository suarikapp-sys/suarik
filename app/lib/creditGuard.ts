// creditGuard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side helper: débito atômico + refund idempotente.
// Usa RPCs Supabase (debit_credits / refund_credits) com row lock.
//
// Usage:
//   const guard = await creditGuard(userId, "lipsync");
//   if (guard.error) return guard.error;  // retorna 402 NextResponse
//   try {
//     const result = await callExpensiveAPI(…);
//     return NextResponse.json(result);
//   } catch (e) {
//     await guard.refund();
//     throw e;
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost, CostMeta } from "@/app/lib/creditCost";
import { randomUUID } from "crypto";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function creditGuard(
  userId: string,
  action: string,
  meta?:  CostMeta,
): Promise<
  | { error: NextResponse; cost?: never; refund?: never; refundId?: never }
  | { error: null; cost: number; refund: () => Promise<void>; refundId: string }
> {
  const cost = computeCost(action, meta);
  if (!cost || cost <= 0) {
    return {
      error: NextResponse.json({ error: "Ação inválida" }, { status: 400 }),
    };
  }

  // Débito atômico via RPC — row lock + validação
  const { data: newBalance, error: rpcErr } = await supabaseAdmin.rpc(
    "debit_credits",
    { p_user_id: userId, p_amount: cost },
  );

  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("profiles_credits_nonnegative") || msg.includes("check constraint")) {
      return {
        error: NextResponse.json(
          { error: "Créditos insuficientes", code: "INSUFFICIENT_CREDITS", required: cost },
          { status: 402 },
        ),
      };
    }
    return {
      error: NextResponse.json({ error: msg }, { status: 500 }),
    };
  }

  if (newBalance === null) {
    // Saldo insuficiente — busca saldo atual pra retornar ao cliente
    const { data: cur } = await supabaseAdmin
      .from("profiles").select("credits").eq("id", userId).single();
    return {
      error: NextResponse.json(
        {
          error:    "Créditos insuficientes",
          code:     "INSUFFICIENT_CREDITS",
          required: cost,
          credits:  cur?.credits ?? 0,
        },
        { status: 402 },
      ),
    };
  }

  // Refund idempotente — usa refund_id único por execução
  const refundId = randomUUID();
  let refunded  = false;

  const refund = async () => {
    if (refunded) return;
    refunded = true;
    await supabaseAdmin.rpc("refund_credits", {
      p_user_id:   userId,
      p_amount:    cost,
      p_action:    action,
      p_refund_id: `${userId}:${refundId}`,
    });
  };

  return { error: null, cost, refund, refundId };
}
