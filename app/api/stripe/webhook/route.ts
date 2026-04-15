// ─── /api/stripe/webhook ── Stripe webhook handler ───────────────────────────
// Idempotency: every event.id is inserted into stripe_events BEFORE side
// effects. A duplicate INSERT (23505) means Stripe retried a successful
// webhook — we 200 and no-op so credits aren't added twice.
//
// Credit flow:
//   - checkout.session.completed (topup)  → add_credits RPC
//   - customer.subscription.created       → set plan + grant initial credits
//   - invoice.paid                        → monthly renewal: set plan credits
//   - customer.subscription.updated       → UPDATE plan/status only, never credits
//   - customer.subscription.deleted       → downgrade to free, keep balance
import { NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { sendTopupEmail, sendSubscriptionEmail } from "@/app/lib/emails";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Returns true if this is the first time we've seen event.id. */
async function markEventProcessed(event: Stripe.Event): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("stripe_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (!error) return true;
  // 23505 = unique_violation → already processed, skip handler
  if (error.code === "23505") {
    console.log(`[stripe/webhook] skipping duplicate event ${event.id} (${event.type})`);
    return false;
  }
  // 42P01 = table missing → log loudly but don't block (migration not yet run)
  if (error.code === "42P01") {
    console.error("[stripe/webhook] stripe_events table missing — run migration! Processing without idempotency guard.");
    return true;
  }
  console.error("[stripe/webhook] idempotency insert failed:", error);
  // Fail closed to avoid double-credit in unknown failure modes
  return false;
}

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

  // ── Idempotency gate ──────────────────────────────────────────────────────
  const isNew = await markEventProcessed(event);
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    // ── One-time credit top-up ──────────────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type !== "topup") break;

      const userId = session.metadata?.supabase_user_id;
      const toAdd  = parseInt(session.metadata?.credits ?? "0", 10);
      if (!userId || !toAdd) break;

      // Atomic add_credits RPC (row lock under the hood)
      const { error: addErr } = await supabaseAdmin.rpc("add_credits", {
        p_user_id: userId,
        p_amount:  toAdd,
      });
      if (addErr) {
        console.error("[stripe/webhook] add_credits RPC failed:", addErr);
        // Return 500 so Stripe retries (idempotency gate will protect us)
        return NextResponse.json({ error: "credit add failed" }, { status: 500 });
      }

      // Send receipt — fire-and-forget
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("full_name, email").eq("id", userId).single();
      const userEmail = (profile as { email?: string } | null)?.email
        ?? session.customer_details?.email ?? "";
      const userName  = (profile as { full_name?: string } | null)?.full_name;
      if (userEmail) {
        const amountTotal = session.amount_total ?? 0;
        const amountStr = `R$ ${(amountTotal / 100).toFixed(2).replace(".", ",")}`;
        sendTopupEmail(userEmail, userName, toAdd, amountStr);
      }
      break;
    }

    // ── First-time subscription: grant initial credits ──────────────────────
    case "customer.subscription.created": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      const plan   = sub.metadata?.plan as PlanKey | undefined;
      if (!userId || !plan || !PLANS[plan]) break;

      const isActive = sub.status === "active" || sub.status === "trialing";
      if (!isActive) break;

      const planCredits = PLANS[plan].credits;
      await supabaseAdmin.from("profiles").update({
        plan,
        subscription_status:    sub.status,
        stripe_subscription_id: sub.id,
        credits:                planCredits,
        updated_at:             new Date().toISOString(),
      }).eq("id", userId);

      const { data: profile } = await supabaseAdmin
        .from("profiles").select("full_name, email").eq("id", userId).single();
      const pEmail = (profile as { email?: string } | null)?.email;
      const pName  = (profile as { full_name?: string } | null)?.full_name;
      if (pEmail) sendSubscriptionEmail(pEmail, pName, plan, planCredits);
      break;
    }

    // ── Monthly renewal: reset credits to plan amount ───────────────────────
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
      // Ignore one-off invoices (topups etc.) — handled above
      if (invoice.billing_reason !== "subscription_cycle" && invoice.billing_reason !== "subscription_create") break;

      const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (!subId) break;

      const sub = await stripe.subscriptions.retrieve(subId);
      const userId = sub.metadata?.supabase_user_id;
      const plan   = sub.metadata?.plan as PlanKey | undefined;
      if (!userId || !plan || !PLANS[plan]) break;

      // Renewal: reset to full plan credits (monthly top-off, not add)
      await supabaseAdmin.from("profiles").update({
        credits:             PLANS[plan].credits,
        plan,
        subscription_status: sub.status,
        updated_at:          new Date().toISOString(),
      }).eq("id", userId);
      break;
    }

    // ── Subscription updated: plan/status only, NEVER touch credits ─────────
    case "customer.subscription.updated": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      const plan   = sub.metadata?.plan as PlanKey | undefined;
      if (!userId) break;

      const isActive = sub.status === "active" || sub.status === "trialing";
      await supabaseAdmin.from("profiles").update({
        plan:                   isActive ? (plan ?? "free") : "free",
        subscription_status:    sub.status,
        stripe_subscription_id: sub.id,
        updated_at:             new Date().toISOString(),
      }).eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub    = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (!userId) break;

      // Preserve credit balance on cancellation — user keeps what they paid for
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
