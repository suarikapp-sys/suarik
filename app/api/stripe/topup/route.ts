import { APP_URL } from "@/app/lib/config";
import { NextResponse } from "next/server";
import { stripe, CREDIT_PACKAGES, type PackageKey } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { pack } = await request.json() as { pack: PackageKey };

    if (!CREDIT_PACKAGES[pack]) {
      return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Busca ou cria o customer no Stripe
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const pkg = CREDIT_PACKAGES[pack];
    const appUrl = APP_URL;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: pkg.priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${appUrl}/dashboard?topup=success&credits=${pkg.credits}`,
      cancel_url:  `${appUrl}/pricing?topup=canceled`,
      metadata: {
        supabase_user_id: user.id,
        credits: String(pkg.credits),
        type: "topup",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe topup error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
