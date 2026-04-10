// POST /api/credits/refund
// Devolve créditos quando uma operação falha após o débito.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { computeCost, CostMeta } from "@/app/lib/creditCost";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, meta } = await req.json() as { action: string; meta?: CostMeta };
  const cost = computeCost(action, meta);
  if (!cost) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("credits").eq("id", user.id).single();

  const current = profile?.credits ?? 0;
  await supabaseAdmin.from("profiles")
    .update({ credits: current + cost }).eq("id", user.id);

  return NextResponse.json({ ok: true, credits: current + cost, refunded: cost });
}
