import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

// ── Subscription plans ────────────────────────────────────────────────────────
// credits = moedas entregues por ciclo de faturamento (resetam mensalmente)
// concurrency = renderizações simultâneas (enforced in backend/queue_router.py)
export const PLANS = {
  starter: {
    name:        "Starter",
    priceId:     process.env.STRIPE_PRICE_STARTER!,
    credits:     5_000,
    price:       "R$ 97",
    concurrency: 1,
    plan:        "starter",
  },
  pro: {
    name:        "Pro",
    priceId:     process.env.STRIPE_PRICE_PRO!,
    credits:     15_000,
    price:       "R$ 197",
    concurrency: 3,
    plan:        "pro",
  },
  growth: {
    name:        "Growth",
    priceId:     process.env.STRIPE_PRICE_GROWTH!,
    credits:     45_000,
    price:       "R$ 497",
    concurrency: 5,
    plan:        "growth",
  },
  enterprise: {
    name:        "Enterprise",
    priceId:     process.env.STRIPE_PRICE_ENTERPRISE!,
    credits:     250_000,
    price:       "R$ 1.997",
    concurrency: 10,
    plan:        "enterprise",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── One-time credit top-up packages ──────────────────────────────────────────
// Compra avulsa para quando o saldo zera antes do próximo ciclo.
export const CREDIT_PACKAGES = {
  small:  { credits: 5_000,  price: "R$ 47",  label: "5.000 moedas",  priceId: process.env.STRIPE_PRICE_TOPUP_SMALL!  },
  medium: { credits: 15_000, price: "R$ 117", label: "15.000 moedas", priceId: process.env.STRIPE_PRICE_TOPUP_MEDIUM! },
  large:  { credits: 50_000, price: "R$ 347", label: "50.000 moedas", priceId: process.env.STRIPE_PRICE_TOPUP_LARGE!  },
} as const;

export type PackageKey = keyof typeof CREDIT_PACKAGES;
