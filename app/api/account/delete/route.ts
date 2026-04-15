// ─── /api/account/delete ── LGPD art. 18: right to erasure ───────────────────
// Irreversible: cancels Stripe subscription, deletes all DB rows, deletes the
// auth user. Requires body { confirm: "EXCLUIR" } to avoid accidental calls.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { rateLimit } from "@/app/lib/rateLimit";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!(await rateLimit(`account:delete:${user.id}`, 3, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  const { confirm } = await request.json().catch(() => ({})) as { confirm?: string };
  if (confirm !== "EXCLUIR") {
    return NextResponse.json(
      { error: "Confirmação obrigatória: envie { confirm: 'EXCLUIR' }" },
      { status: 400 }
    );
  }

  const userId = user.id;
  console.log(`[account/delete] starting erasure for user ${userId}`);

  // ── 1. Cancel Stripe subscription if any ─────────────────────────────────
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", userId)
      .single();

    const subId = (profile as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
    if (subId) {
      await stripe.subscriptions.cancel(subId).catch(e =>
        console.warn(`[account/delete] stripe cancel failed for sub ${subId}:`, e)
      );
    }
    // Note: we DON'T delete the Stripe customer — invoice history must be kept
    // for accounting/tax. Customer remains but is no longer linked to any user.
  } catch (e) {
    console.warn("[account/delete] Stripe cleanup failed (non-fatal):", e);
  }

  // ── 2. Delete DB rows in dependency order ────────────────────────────────
  // credit_refunds stores refund_id scoped like "<userId>:<uuid>"
  await supabaseAdmin.from("credit_refunds").delete().like("refund_id", `${userId}:%`);
  await supabaseAdmin.from("cloned_voices").delete().eq("user_id", userId);
  await supabaseAdmin.from("projects").delete().eq("user_id", userId);
  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  // ── 3. Delete the auth user (cascades sign-out on all devices) ───────────
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error(`[account/delete] auth.admin.deleteUser failed for ${userId}:`, authErr);
    return NextResponse.json(
      { error: "Dados removidos mas falha ao encerrar sessão. Contate suporte@suarik.com." },
      { status: 500 }
    );
  }

  console.log(`[account/delete] erasure complete for user ${userId}`);
  return NextResponse.json({ ok: true });
}
