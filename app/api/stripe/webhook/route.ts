import { NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

// Service role client para ignorar RLS (só webhook usa isso)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const sig  = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // ── One-time credit top-up ──────────────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type !== "topup") break;

      const userId  = session.metadata?.supabase_user_id;
      const toAdd   = parseInt(session.metadata?.credits ?? "0", 10);
      if (!userId || !toAdd) break;

      const { data } = await supabaseAdmin
        .from("profiles").select("credits").eq("id", userId).single();
      const current = (data as { credits: number } | null)?.credits ?? 0;

      await supabaseAdmin.from("profiles")
        .update({ credits: current + toAdd, updated_at: new Date().toISOString() })
        .eq("id", userId);
      break;
    }

    // ── Subscription events ─────────────────────────────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      const plan   = sub.metadata?.plan as PlanKey | undefined;
      if (!userId) break;

      const isActive = sub.status === "active" || sub.status === "trialing";
      const credits  = plan && PLANS[plan] ? PLANS[plan].credits : 100;

      await supabaseAdmin.from("profiles").update({
        plan:                   isActive ? (plan ?? "free") : "free",
        subscription_status:    sub.status,
        stripe_subscription_id: sub.id,
        credits:                isActive ? credits : 10,
        updated_at:             new Date().toISOString(),
      }).eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub2 = event.data.object as Stripe.Subscription;
      const userId = sub2.metadata?.supabase_user_id;
      if (!userId) break;

      await supabaseAdmin.from("profiles").update({
        plan:                   "free",
        subscription_status:    "canceled",
        stripe_subscription_id: null,
        credits:                100,
        updated_at:             new Date().toISOString(),
      }).eq("id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
