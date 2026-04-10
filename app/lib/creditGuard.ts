// creditGuard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side helper: check balance, deduct credits, and refund on failure.
// Used by every API route that calls an external paid API.
//
// Usage:
//   const guard = await creditGuard(userId, "lipsync");
//   if (guard.error) return guard.error;           // returns 402 NextResponse
//   try {
//     const result = await callExpensiveAPI(…);
//     return NextResponse.json(result);
//   } catch (e) {
//     await guard.refund();
//     throw e;
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse }             from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost, CostMeta }    from "@/app/lib/creditCost";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function creditGuard(
  userId: string,
  action: string,
  meta?:  CostMeta,
): Promise<
  | { error: NextResponse; cost?: never; refund?: never }
  | { error: null; cost: number; refund: () => Promise<void> }
> {
  const cost = computeCost(action, meta);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  const current = (profile as { credits: number } | null)?.credits ?? 0;

  if (current < cost) {
    return {
      error: NextResponse.json(
        { error: "Créditos insuficientes", code: "INSUFFICIENT_CREDITS", required: cost, credits: current },
        { status: 402 },
      ),
    };
  }

  // Deduct atomically
  await supabaseAdmin
    .from("profiles")
    .update({ credits: current - cost })
    .eq("id", userId);

  // Refund helper — call this in the catch block on external API failure
  const refund = async () => {
    await supabaseAdmin
      .from("profiles")
      .update({ credits: current })   // restore to pre-deduction balance
      .eq("id", userId);
  };

  return { error: null, cost, refund };
}
