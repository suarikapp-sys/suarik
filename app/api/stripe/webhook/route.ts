import { NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { sendTopupEmail, sendSubscriptionEmail } from "@/app/lib/emails";

// Service role client para ignorar RLS (só webhook usa isso)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const sig  = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

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

      // ── Idempotency guard: mark PaymentIntent as processed via Stripe metadata
      // If this webhook fires twice (Stripe retry), we skip the second credit add.
      const paymentIntentId = session.payment_intent as string | null;
      if (paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.metadata?.credits_processed === "true") {
          break;
        }
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: { ...pi.metadata, credits_processed: "true" },
        });
      }

      const { data } = await supabaseAdmin
        .from("profiles").select("credits, full_name, email").eq("id", userId).single();
      const current = (data as { credits: number; full_name?: string; email?: string } | null)?.credits ?? 0;
      const userName = (data as { full_name?: string } | null)?.full_name;
      const userEmail = (data as { email?: string } | null)?.email ?? session.customer_details?.email ?? "";

      await supabaseAdmin.from("profiles")
        .update({ credits: current + toAdd, updated_at: new Date().toISOString() })
        .eq("id", userId);

      // Send payment confirmation email — fire-and-forget
      if (userEmail) {
        const amountTotal = session.amount_total ?? 0;
        const amountStr = `R$ ${(amountTotal / 100).toFixed(2).replace(".", ",")}`;
        sendTopupEmail(userEmail, userName, toAdd, amountStr);
      }
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

      // Send subscription confirmation email — fire-and-forget
      if (isActive && plan) {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("full_name, email").eq("id", userId).single();
        const pEmail = (profile as { email?: string } | null)?.email;
        const pName  = (profile as { full_name?: string } | null)?.full_name;
        if (pEmail) sendSubscriptionEmail(pEmail, pName, plan, credits);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub2 = event.data.object as Stripe.Subscription;
      const userId = sub2.metadata?.supabase_user_id;
      if (!userId) break;

      // Preserve whatever credits the user has — don't wipe them on cancellation.
      // Only downgrade the plan and clear the subscription reference.
      await supabaseAdmin.from("profiles").update({
        plan:                   "free",
        subscription_status:    "canceled",
        stripe_subscription_id: null,
        updated_at:             new Date().toISOString(),
      }).eq("id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
