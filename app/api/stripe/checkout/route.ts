import { APP_URL } from "@/app/lib/config";
import { NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { plan } = await request.json() as { plan: PlanKey };

    if (!PLANS[plan]) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }

    // ── Env validation: priceId must be set and not a placeholder ────────────
    const priceId = PLANS[plan].priceId;
    if (!priceId || priceId.includes("REPLACE") || !priceId.startsWith("price_")) {
      console.error(`[stripe/checkout] Missing/invalid STRIPE_PRICE_${plan.toUpperCase()} env var`);
      return NextResponse.json(
        { error: "Assinatura indisponível no momento. Tente novamente em instantes." },
        { status: 503 }
      );
    }

    // Pega o usuário logado
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Busca ou cria o customer no Stripe
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Cria a sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${APP_URL}/dashboard?checkout=success`,
      cancel_url:  `${APP_URL}/pricing?checkout=canceled`,
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
